import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId },
      include: { role: true },
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
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
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

  async update(id: string, dto: UpdateUserDto, businessId: string) {
    await this.findOne(id, businessId); // lanza 404 si no existe

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

  async deactivate(id: string, businessId: string) {
    await this.findOne(id, businessId);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }

  async findRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
