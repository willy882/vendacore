import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private email: EmailService,
  ) {}

  async login(dto: LoginDto, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        business: true,
      },
    });

    // No revelar si el usuario existe o no (mismo mensaje para ambos casos)
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Tu cuenta está desactivada. Contacta al administrador.');
    }

    // Verificar estado del negocio (excepto super_admin)
    if (user.role?.name !== 'super_admin' && user.business) {
      if (user.business.status === 'pendiente') {
        throw new ForbiddenException('Tu cuenta está pendiente de activación. Recibirás acceso en breve.');
      }
      if (user.business.status === 'suspendido') {
        throw new ForbiddenException('El acceso a este negocio está suspendido. Contacta a soporte VendaCore.');
      }
      if (user.business.status === 'cancelado') {
        throw new ForbiddenException('La suscripción de este negocio ha sido cancelada.');
      }
    }

    // Verificar bloqueo por intentos fallidos
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutesLeft} minuto(s).`,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Login exitoso: resetear contador de intentos
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // Registrar en auditoría
    await this.prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        userId: user.id,
        modulo: 'auth',
        accion: 'login',
        entidad: 'User',
        entidadId: user.id,
        ipAddress,
        datosNuevos: { email: user.email, timestamp: new Date() },
      },
    });

    this.logger.log(`Login exitoso: ${user.email} desde ${ipAddress}`);

    const tokens = await this.generateTokens(user);

    const { passwordHash: _, twoFactorSecret: __, ...safeUser } = user;

    return {
      user: safeUser,
      ...tokens,
    };
  }

  async refreshTokens(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('No autorizado');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { businessId: true, email: true },
    });

    if (user) {
      await Promise.all([
        this.prisma.auditLog.create({
          data: {
            businessId: user.businessId,
            userId,
            modulo: 'auth',
            accion: 'logout',
            entidad: 'User',
            entidadId: userId,
            ipAddress,
            datosNuevos: { timestamp: new Date() },
          },
        }),
        // Incrementar tokenVersion invalida todos los refresh tokens existentes
        this.prisma.user.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        }),
      ]);
    }

    return { message: 'Sesión cerrada correctamente' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        business: true,
      },
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const { passwordHash: _, twoFactorSecret: __, ...safeUser } = user;
    return safeUser;
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Ya existe una cuenta con ese correo electrónico');

    const existingBusiness = await this.prisma.business.findUnique({ where: { ruc: dto.ruc } });
    if (existingBusiness) throw new ConflictException('Ya existe un negocio registrado con ese RUC');

    const adminRole = await this.prisma.role.findUnique({ where: { name: 'administrador' } });
    if (!adminRole) throw new BadRequestException('El rol administrador no está configurado en el sistema');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + 30);

    await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          ruc: dto.ruc,
          razonSocial: dto.nombreNegocio,
          nombreComercial: dto.nombreNegocio,
          telefono: dto.telefono,
          status: 'activo',
        },
      });

      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          nombre: dto.nombre,
          apellido: dto.apellido,
          roleId: adminRole.id,
          businessId: business.id,
          isActive: true,
        },
      });

      await tx.businessSubscription.create({
        data: {
          businessId: business.id,
          planId: null,
          estado: 'activo',
          fechaInicio,
          fechaFin,
          notas: 'Período de prueba gratuito — 30 días',
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          userId: newUser.id,
          modulo: 'auth',
          accion: 'register',
          entidad: 'Business',
          entidadId: business.id,
          datosNuevos: { nombreNegocio: dto.nombreNegocio, email: dto.email },
        },
      });
    });

    this.logger.log(`Nuevo negocio registrado (prueba gratuita 30d): ${dto.nombreNegocio} (${dto.email})`);

    // Notificar al admin WCode (no bloquea la respuesta)
    this.email.sendNewBusinessNotification({
      nombreNegocio: dto.nombreNegocio,
      ruc:           dto.ruc,
      nombre:        dto.nombre,
      apellido:      dto.apellido,
      email:         dto.email,
      telefono:      dto.telefono,
      trialEnds:     fechaFin.toISOString(),
    }).catch(() => {});

    // Bienvenida al cliente (no bloquea la respuesta)
    this.email.sendWelcomeEmail({
      to:           dto.email,
      nombre:       dto.nombre,
      businessName: dto.nombreNegocio,
      trialEnd:     fechaFin.toISOString(),
    }).catch(() => {});

    return {
      message: 'Registro exitoso. Tu cuenta está activa con 30 días de prueba gratuita.',
      trialDays: 30,
      trialEnds: fechaFin.toISOString(),
    };
  }

  async forgotPassword(emailAddr: string) {
    const user = await this.prisma.user.findUnique({ where: { email: emailAddr } });
    // No revelamos si existe o no
    if (!user) return { message: 'Si el correo existe, recibirás un enlace en breve.' };

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://vendacore-jade.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.email.sendPasswordReset(emailAddr, user.nombre, resetUrl);

    this.logger.log(`Reset de contraseña solicitado: ${emailAddr}`);
    return { message: 'Si el correo existe, recibirás un enlace en breve.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gte: new Date() },
      },
    });

    if (!user) throw new BadRequestException('El enlace de restablecimiento es inválido o ha expirado.');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    this.logger.log(`Contraseña restablecida: ${user.email}`);
    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async generateTokens(user: { id: string; email: string; businessId: string; roleId: string; tokenVersion?: number }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      businessId: user.businessId,
      roleId: user.roleId,
      tokenVersion: user.tokenVersion ?? 0,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES || '10h') as any,
      }),
      this.jwtService.signAsync(payload as any, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES || '30d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async handleFailedLogin(userId: string, currentAttempts: number) {
    const newAttempts = currentAttempts + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `Cuenta bloqueada por ${MAX_FAILED_ATTEMPTS} intentos fallidos: userId=${userId}`,
      );
    }
  }
}
