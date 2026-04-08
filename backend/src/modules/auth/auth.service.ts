import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
      await this.prisma.auditLog.create({
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
      });
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

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async generateTokens(user: { id: string; email: string; businessId: string; roleId: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      businessId: user.businessId,
      roleId: user.roleId,
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
