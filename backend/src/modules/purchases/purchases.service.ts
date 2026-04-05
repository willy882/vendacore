import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Prisma } from '@prisma/client';

const IGV_RATE = 0.18;

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  async create(dto: CreatePurchaseDto, userId: string, businessId: string) {
    // Validar proveedor
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, businessId },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    // Validar productos
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no encontrados');
    }

    // Calcular totales (costos sin IGV)
    const itemsCalc = dto.items.map((item) => {
      const subtotalItem = item.cantidad * item.costoUnitario;
      return {
        productId: item.productId,
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
        total: subtotalItem,
      };
    });

    const subtotal = itemsCalc.reduce((a, i) => a + i.total, 0);
    const igv      = subtotal * IGV_RATE;
    const total    = subtotal + igv;

    // Crear compra en transacción
    const purchase = await this.prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId: dto.supplierId,
          userId,
          fecha: new Date(dto.fecha),
          tipoDocumento: dto.tipoDocumento ?? null,
          numeroDocumento: dto.numeroDocumento ?? null,
          subtotal,
          igv,
          total,
          estadoPago: (dto.estadoPago as any) ?? 'pendiente',
          observaciones: dto.observaciones ?? null,
          items: { create: itemsCalc },
        },
        include: { items: { include: { product: true } }, supplier: true },
      });

      // Actualizar deuda del proveedor si queda pendiente
      if (dto.estadoPago !== 'pagado') {
        const pendiente = dto.estadoPago === 'parcial' ? total / 2 : total;
        await tx.supplier.update({
          where: { id: dto.supplierId },
          data: { deudaPendiente: { increment: pendiente } },
        });
      }

      return newPurchase;
    });

    // Ingresar productos al inventario
    for (const item of dto.items) {
      await this.inventoryService.registerMovement({
        businessId,
        productId: item.productId,
        userId,
        tipo: 'entrada_compra',
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
        referenciaId: purchase.id,
        referenciaTipo: 'purchase',
      });
    }

    return purchase;
  }

  async findAll(
    businessId: string,
    filters: { supplierId?: string; from?: string; to?: string; page?: number; limit?: number },
  ) {
    const { supplierId, from, to, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = {
      businessId,
      ...(supplierId && { supplierId }),
      ...((from || to) && {
        fecha: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to + 'T23:59:59Z') }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, razonSocial: true } },
          user: { select: { nombre: true, apellido: true } },
          items: { include: { product: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, businessId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        supplier: true,
        user: { select: { nombre: true, apellido: true } },
        items: { include: { product: true } },
      },
    });
    if (!purchase) throw new NotFoundException('Compra no encontrada');
    return purchase;
  }

  async markAsPaid(id: string, businessId: string) {
    const purchase = await this.findOne(id, businessId);
    if (purchase.estadoPago === 'pagado') {
      throw new BadRequestException('La compra ya está marcada como pagada');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.purchase.update({
        where: { id },
        data: { estadoPago: 'pagado' },
      }),
      this.prisma.supplier.update({
        where: { id: purchase.supplierId },
        data: { deudaPendiente: { decrement: Number(purchase.total) } },
      }),
    ]);

    return updated;
  }

  async getPendingPayments(businessId: string) {
    return this.prisma.purchase.findMany({
      where: { businessId, estadoPago: { in: ['pendiente', 'parcial'] } },
      include: { supplier: { select: { razonSocial: true } } },
      orderBy: { fecha: 'asc' },
    });
  }
}
