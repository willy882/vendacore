import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, search?: string) {
    const where: Prisma.SupplierWhereInput = {
      businessId,
      isActive: true,
      ...(search && {
        OR: [
          { razonSocial: { contains: search, mode: 'insensitive' } },
          { ruc: { contains: search, mode: 'insensitive' } },
          { nombreContacto: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    return this.prisma.supplier.findMany({
      where,
      orderBy: { razonSocial: 'asc' },
    });
  }

  async findOne(id: string, businessId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
      include: {
        purchases: {
          orderBy: { fecha: 'desc' },
          take: 20,
          select: {
            id: true, fecha: true, total: true,
            estadoPago: true, numeroDocumento: true,
          },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  async create(dto: CreateSupplierDto, businessId: string) {
    if (dto.ruc) {
      const dup = await this.prisma.supplier.findFirst({
        where: { ruc: dto.ruc, businessId, isActive: true },
      });
      if (dup) throw new ConflictException('Ya existe un proveedor con ese RUC');
    }
    return this.prisma.supplier.create({
      data: { ...dto, businessId },
    });
  }

  async update(id: string, dto: UpdateSupplierDto, businessId: string) {
    await this.findOne(id, businessId);
    if (dto.ruc) {
      const dup = await this.prisma.supplier.findFirst({
        where: { ruc: dto.ruc, businessId, isActive: true, NOT: { id } },
      });
      if (dup) throw new ConflictException('RUC ya en uso por otro proveedor');
    }
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async deactivate(id: string, businessId: string) {
    await this.findOne(id, businessId);
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, razonSocial: true, isActive: true },
    });
  }

  async getDeudas(businessId: string) {
    return this.prisma.supplier.findMany({
      where: { businessId, isActive: true, deudaPendiente: { gt: 0 } },
      select: {
        id: true, razonSocial: true, ruc: true,
        telefono: true, deudaPendiente: true,
      },
      orderBy: { deudaPendiente: 'desc' },
    });
  }
}
