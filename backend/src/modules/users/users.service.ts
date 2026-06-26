import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { PlanEnforcementService } from '../plan-enforcement/plan-enforcement.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
  ) {}

  async findAll(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId, role: { name: { not: 'super_admin' } } },
      include: { role: true },
      orderBy: { nombre: 'asc' },
    }).then((users) =>
      users.map(({ passwordHash: _, twoFactorSecret: __, ...u }) => u),
    );
  }

  async findAllGlobal() {
    return this.prisma.user.findMany({
      where: { role: { name: { not: 'super_admin' } } },
      include: { role: true, business: true },
      orderBy: { nombre: 'asc' },
    }).then((users) =>
      users.map(({ passwordHash: _, twoFactorSecret: __, ...u }) => u),
    );
  }

  async findOne(id: string, businessId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, businessId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const { passwordHash: _, twoFactorSecret: __, ...safe } = user;
    return safe;
  }

  async create(dto: CreateUserDto, businessId: string) {
    await this.planEnforcement.checkUsuarios(businessId);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException('El rol especificado no existe');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        roleId: dto.roleId,
        businessId,
        isActive: dto.isActive ?? true,
      },
      include: { role: true },
    });

    const { passwordHash: _, twoFactorSecret: __, ...safe } = user;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto, businessId: string | null) {
    // businessId null = super_admin, sin restricción de negocio
    const existing = businessId
      ? await this.prisma.user.findFirst({ where: { id, businessId }, include: { role: true } })
      : await this.prisma.user.findUnique({ where: { id }, include: { role: true } });

    if (!existing) throw new NotFoundException('Usuario no encontrado');

    // Impedir desactivar super_admin
    if ((existing as any).role?.name === 'super_admin' && dto.isActive === false) {
      throw new ForbiddenException('No se puede desactivar un usuario super_admin');
    }

    const updateData: any = {};
    if (dto.nombre) updateData.nombre = dto.nombre;
    if (dto.apellido) updateData.apellido = dto.apellido;
    if (dto.roleId) updateData.roleId = dto.roleId;
    if (typeof dto.isActive === 'boolean') updateData.isActive = dto.isActive;

    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) throw new ConflictException('El correo ya está en uso');
      updateData.email = dto.email;
    }

    if (dto.newPassword) {
      updateData.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    }
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });

    const { passwordHash: _, twoFactorSecret: __, ...safe } = user;
    return safe;
  }

  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { message: 'Contraseña actualizada correctamente' };
  }

  async deactivate(id: string, businessId: string) {
    await this.findOne(id, businessId);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }

  async deleteUser(id: string, businessId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, businessId },
      include: { role: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if ((user as any).role?.name === 'administrador') {
      // Contar cuántos admins activos quedan
      const adminCount = await this.prisma.user.count({
        where: { businessId, isActive: true, role: { name: 'administrador' } },
      });
      if (adminCount <= 1) throw new BadRequestException('No se puede eliminar el único administrador activo');
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuario eliminado' };
  }

  async findRoles() {
    return this.prisma.role.findMany({
      where: { name: { not: 'super_admin' } },
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
