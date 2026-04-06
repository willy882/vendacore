import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryKardexDto } from './dto/query-kardex.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  // ── KARDEX ───────────────────────────────────────────────────────────────

  async getKardex(productId: string, query: QueryKardexDto, businessId: string) {
    const { from, to, tipo, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = {
      productId,
      businessId,
      ...(tipo && { tipo: tipo as any }),
      ...(from || to
        ? {
            fecha: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to + 'T23:59:59Z') }),
            },
          }
        : {}),
    };

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          user: { select: { id: true, nombre: true, apellido: true } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── AJUSTE DE STOCK ──────────────────────────────────────────────────────

  async adjustStock(dto: AdjustStockDto, userId: string, businessId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId, isActive: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const stockAnterior = Number(product.stockActual);
    let stockNuevo: number;

    if (dto.tipo === 'ajuste_entrada') {
      stockNuevo = stockAnterior + dto.cantidad;
    } else {
      if (dto.cantidad > stockAnterior) {
        throw new BadRequestException(
          `Stock insuficiente. Stock actual: ${stockAnterior}, solicitado: ${dto.cantidad}`,
        );
      }
      stockNuevo = stockAnterior - dto.cantidad;
    }

    // Transacción: actualizar stock + registrar movimiento
    const [updatedProduct, movement] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: dto.productId },
        data: { stockActual: stockNuevo },
      }),
      this.prisma.inventoryMovement.create({
        data: {
          businessId,
          productId: dto.productId,
          userId,
          tipo: dto.tipo as any,
          cantidad: dto.cantidad,
          stockAnterior,
          stockNuevo,
          costoUnitario: dto.costoUnitario ?? null,
          observaciones: dto.observaciones ?? dto.motivo ?? null,
          fecha: new Date(),
        },
      }),
    ]);

    this.logger.log(
      `Ajuste stock: product=${dto.productId} ${dto.tipo} cantidad=${dto.cantidad} ` +
      `(${stockAnterior} -> ${stockNuevo}) by user=${userId}`,
    );

    // Alerta si stock quedó en nivel crítico
    const isCritical = stockNuevo <= Number(product.stockMinimo);

    return {
      product: updatedProduct,
      movement,
      alert: isCritical
        ? {
            tipo: 'stock_critico',
            mensaje: `⚠ Stock crítico: ${product.nombre} tiene ${stockNuevo} unidades (mínimo: ${product.stockMinimo})`,
          }
        : null,
    };
  }

  // ── INVENTARIO VALORIZADO ────────────────────────────────────────────────

  async getValorizado(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      include: { category: true },
      orderBy: { nombre: 'asc' },
    });

    const data = products.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigoInterno: p.codigoInterno,
      categoria: p.category?.nombre ?? null,
      stockActual: Number(p.stockActual),
      precioCompra: Number(p.precioCompra ?? 0),
      precioVenta: Number(p.precioVenta),
      valorCosto: Number(p.stockActual) * Number(p.precioCompra ?? 0),
      valorVenta: Number(p.stockActual) * Number(p.precioVenta),
    }));

    const totales = data.reduce(
      (acc, p) => ({
        totalCosto: acc.totalCosto + p.valorCosto,
        totalVenta: acc.totalVenta + p.valorVenta,
        totalProductos: acc.totalProductos + 1,
      }),
      { totalCosto: 0, totalVenta: 0, totalProductos: 0 },
    );

    return { data, totales };
  }

  // ── ROTACIÓN DE PRODUCTOS ────────────────────────────────────────────────

  async getRotacion(businessId: string, days: number = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - days);

    const movements = await this.prisma.inventoryMovement.groupBy({
      by: ['productId'],
      where: {
        businessId,
        tipo: 'salida_venta',
        fecha: { gte: desde },
      },
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
    });

    const productIds = movements.map((m) => m.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nombre: true, codigoInterno: true, stockActual: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return movements.map((m) => ({
      ...productMap.get(m.productId),
      totalVendido: Number(m._sum.cantidad ?? 0),
    }));
  }

  // ── Método interno: registrar movimiento desde otros módulos ─────────────

  async registerMovement(
    data: {
      businessId: string;
      productId: string;
      userId: string;
      tipo: 'entrada_compra' | 'salida_venta' | 'devolucion';
      cantidad: number;
      costoUnitario?: number;
      referenciaId?: string;
      referenciaTipo?: string;
      observaciones?: string;
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) throw new NotFoundException(`Producto ${data.productId} no encontrado`);

    const stockAnterior = Number(product.stockActual);
    const stockNuevo =
      data.tipo === 'salida_venta'
        ? stockAnterior - data.cantidad
        : stockAnterior + data.cantidad;

    if (stockNuevo < 0) {
      throw new BadRequestException(
        `Stock insuficiente para producto "${product.nombre}". Disponible: ${stockAnterior}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: data.productId },
        data: { stockActual: stockNuevo },
      }),
      this.prisma.inventoryMovement.create({
        data: {
          businessId: data.businessId,
          productId: data.productId,
          userId: data.userId,
          tipo: data.tipo as any,
          cantidad: data.cantidad,
          stockAnterior,
          stockNuevo,
          costoUnitario: data.costoUnitario ?? null,
          referenciaId: data.referenciaId ?? null,
          referenciaTipo: data.referenciaTipo ?? null,
          observaciones: data.observaciones ?? null,
          fecha: new Date(),
        },
      }),
    ]);
  }
}
