import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, search?: string) {
    const where: Prisma.CustomerWhereInput = {
      businessId,
      isActive: true,
      ...(search && {
        OR: [
          { nombreCompleto: { contains: search, mode: 'insensitive' } },
          { numeroDocumento: { contains: search, mode: 'insensitive' } },
          { razonSocial: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    return this.prisma.customer.findMany({
      where,
      orderBy: { nombreCompleto: 'asc' },
    });
  }

  async findOne(id: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId },
      include: {
        sales: {
          orderBy: { fecha: 'desc' },
          take: 20,
          select: {
            id: true, fecha: true, total: true,
            estado: true, tipoVenta: true,
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(dto: CreateCustomerDto, businessId: string) {
    if (dto.numeroDocumento) {
      const dup = await this.prisma.customer.findFirst({
        where: { numeroDocumento: dto.numeroDocumento, businessId },
      });
      if (dup) throw new ConflictException('Ya existe un cliente con ese número de documento');
    }
    return this.prisma.customer.create({
      data: { ...dto, businessId, tipoDocumento: dto.tipoDocumento as any },
    });
  }

  async update(id: string, dto: UpdateCustomerDto, businessId: string) {
    await this.findOne(id, businessId);
    if (dto.numeroDocumento) {
      const dup = await this.prisma.customer.findFirst({
        where: { numeroDocumento: dto.numeroDocumento, businessId, NOT: { id } },
      });
      if (dup) throw new ConflictException('Número de documento ya en uso');
    }
    return this.prisma.customer.update({
      where: { id },
      data: { ...dto, tipoDocumento: dto.tipoDocumento as any },
    });
  }

  async deactivate(id: string, businessId: string) {
    await this.findOne(id, businessId);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, nombreCompleto: true, isActive: true },
    });
  }

  async getRanking(businessId: string, limit = 10) {
    const sales = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: { businessId, estado: 'activa', customerId: { not: null } },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const customerIds = sales.map((s) => s.customerId!).filter(Boolean);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, nombreCompleto: true, numeroDocumento: true, telefono: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));

    return sales.map((s) => ({
      ...map.get(s.customerId!),
      totalCompras: Number(s._sum.total ?? 0),
      cantidadTransacciones: s._count.id,
    }));
  }

  async getDeudores(businessId: string) {
    return this.prisma.customer.findMany({
      where: { businessId, isActive: true, creditoUsado: { gt: 0 } },
      select: {
        id: true, nombreCompleto: true, numeroDocumento: true,
        telefono: true, creditoLimite: true, creditoUsado: true,
      },
      orderBy: { creditoUsado: 'desc' },
    });
  }
}
