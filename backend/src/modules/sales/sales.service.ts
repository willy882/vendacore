import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';
import { Prisma } from '@prisma/client';

const IGV_RATE = 0.18;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  // ── REGISTRAR VENTA ──────────────────────────────────────────────────────

  async create(dto: CreateSaleDto, userId: string, businessId: string) {
    // 1. Validar productos y calcular totales
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId, isActive: true },
    });

    if (products.length !== productIds.length) {
      const found = products.map((p) => p.id);
      const missing = productIds.filter((id) => !found.includes(id));
      throw new BadRequestException(`Productos no encontrados o inactivos: ${missing.join(', ')}`);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Calcular items
    let subtotal = 0;
    let descuentoTotal = 0;
    let igvTotal = 0;

    const itemsCalc = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const precio  = item.precioUnitario;
      const desc    = item.descuento ?? 0;
      const itemSubtotal = (precio - desc) * item.cantidad;

      let igvMonto = 0;
      if (product.igvTipo === 'gravado') {
        igvMonto = itemSubtotal * IGV_RATE;
      }

      subtotal      += itemSubtotal;
      descuentoTotal += desc * item.cantidad;
      igvTotal      += igvMonto;

      return {
        productId: item.productId,
        cantidad: item.cantidad,
        precioUnitario: precio,
        descuento: desc,
        subtotal: itemSubtotal,
        igvMonto,
        total: itemSubtotal + igvMonto,
      };
    });

    const total = subtotal + igvTotal;

    // 3. Validar stock
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      if (Number(product.stockActual) < item.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente para "${product.nombre}". Disponible: ${product.stockActual}, solicitado: ${item.cantidad}`,
        );
      }
    }

    // 4. Validar pagos
    const totalPagado = dto.payments.reduce((acc, p) => acc + p.monto, 0);
    if (dto.tipoVenta === 'contado' && totalPagado < total) {
      throw new BadRequestException(
        `Pago insuficiente. Total: ${total.toFixed(2)}, pagado: ${totalPagado.toFixed(2)}`,
      );
    }

    const saldoPendiente = Math.max(0, total - totalPagado);
    const montoPagado    = Math.min(totalPagado, total);

    // 5. Crear venta en transacción
    const sale = await this.prisma.$transaction(async (tx) => {
      // Crear cabecera de venta
      const newSale = await tx.sale.create({
        data: {
          businessId,
          userId,
          customerId: dto.customerId ?? null,
          cashSessionId: dto.cashSessionId ?? null,
          tipoVenta: (dto.tipoVenta as any) ?? 'contado',
          estado: saldoPendiente > 0 ? 'pendiente_pago' : 'activa',
          fecha: new Date(),
          subtotal,
          descuentoTotal,
          igv: igvTotal,
          total,
          montoPagado,
          saldoPendiente,
          observaciones: dto.observaciones ?? null,
          items: {
            create: itemsCalc,
          },
          payments: {
            create: dto.payments.map((p) => ({
              paymentMethodId: p.paymentMethodId,
              monto: p.monto,
              referencia: p.referencia ?? null,
              fecha: new Date(),
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          payments: { include: { paymentMethod: true } },
          customer: true,
        },
      });

      // Registrar movimiento de caja si hay sesión abierta
      if (dto.cashSessionId && montoPagado > 0) {
        const effectivePayment = dto.payments.find((p) => p.monto > 0);
        if (effectivePayment) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: dto.cashSessionId,
              userId,
              paymentMethodId: effectivePayment.paymentMethodId,
              saleId: newSale.id,
              tipo: 'ingreso',
              concepto: `Venta #${newSale.id.slice(-6).toUpperCase()}`,
              monto: montoPagado,
              fecha: new Date(),
            },
          });
        }
      }

      // Actualizar crédito usado del cliente si es venta a crédito
      if (dto.customerId && dto.tipoVenta === 'credito' && saldoPendiente > 0) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { creditoUsado: { increment: saldoPendiente } },
        });
      }

      return newSale;
    });

    // 6. Descontar stock (fuera de la transacción principal para no bloquear)
    for (const item of dto.items) {
      await this.inventoryService.registerMovement({
        businessId,
        productId: item.productId,
        userId,
        tipo: 'salida_venta',
        cantidad: item.cantidad,
        referenciaId: sale.id,
        referenciaTipo: 'sale',
      });
    }

    this.logger.log(`Venta creada: ${sale.id} | Total: S/ ${total.toFixed(2)} | Usuario: ${userId}`);

    return {
      ...sale,
      vuelto: Math.max(0, totalPagado - total),
    };
  }

  // ── HISTORIAL ────────────────────────────────────────────────────────────

  async findAll(query: QuerySaleDto, businessId: string) {
    const { from, to, customerId, userId, estado, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {
      businessId,
      ...(estado && { estado: estado as any }),
      ...(customerId && { customerId }),
      ...(userId && { userId }),
      ...((from || to) && {
        fecha: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to + 'T23:59:59Z') }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, nombreCompleto: true, numeroDocumento: true } },
          user: { select: { id: true, nombre: true, apellido: true } },
          items: { include: { product: { select: { nombre: true } } } },
          payments: { include: { paymentMethod: { select: { nombre: true, tipo: true } } } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, businessId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        user: { select: { id: true, nombre: true, apellido: true } },
        items: { include: { product: true } },
        payments: { include: { paymentMethod: true } },
        electronicDocuments: {
          select: { id: true, tipo: true, numeroCompleto: true, estado: true, pdfUrl: true },
        },
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  // ── ANULAR VENTA ─────────────────────────────────────────────────────────

  async cancel(id: string, dto: CancelSaleDto, userId: string, businessId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: true },
    });

    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.estado === 'anulada') {
      throw new BadRequestException('La venta ya fue anulada');
    }

    // Anular en transacción
    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id },
        data: {
          estado: 'anulada',
          anulacionMotivo: dto.motivo,
          anuladoPorId: userId,
          anuladoAt: new Date(),
        },
      });

      // Revertir crédito del cliente si aplica
      if (sale.customerId && sale.tipoVenta === 'credito' && Number(sale.saldoPendiente) > 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { creditoUsado: { decrement: Number(sale.saldoPendiente) } },
        });
      }
    });

    // Revertir stock (devolucion)
    for (const item of sale.items) {
      await this.inventoryService.registerMovement({
        businessId,
        productId: item.productId,
        userId,
        tipo: 'devolucion',
        cantidad: Number(item.cantidad),
        referenciaId: sale.id,
        referenciaTipo: 'sale_cancel',
        observaciones: `Anulación: ${dto.motivo}`,
      });
    }

    this.logger.log(`Venta anulada: ${id} por usuario ${userId}. Motivo: ${dto.motivo}`);
    return { message: 'Venta anulada correctamente', saleId: id };
  }

  // ── RESUMEN / ESTADÍSTICAS ───────────────────────────────────────────────

  async getSummary(businessId: string, period: 'today' | 'week' | 'month' | 'year') {
    const now = new Date();
    const from = new Date();

    switch (period) {
      case 'today': from.setHours(0, 0, 0, 0); break;
      case 'week':  from.setDate(now.getDate() - 7); break;
      case 'month': from.setDate(1); from.setHours(0, 0, 0, 0); break;
      case 'year':  from.setMonth(0, 1); from.setHours(0, 0, 0, 0); break;
    }

    const where: Prisma.SaleWhereInput = {
      businessId,
      estado: 'activa',
      fecha: { gte: from, lte: now },
    };

    const [agg, count, topProducts] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _sum: { total: true, igv: true, descuentoTotal: true },
        _avg: { total: true },
        _count: { id: true },
      }),
      this.prisma.sale.count({ where }),
      // Top 5 productos más vendidos en el período
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { businessId, estado: 'activa', fecha: { gte: from } } },
        _sum: { cantidad: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    const productIds = topProducts.map((t) => t.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nombre: true, codigoInterno: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      period,
      totalVentas: Number(agg._sum.total ?? 0),
      totalIgv: Number(agg._sum.igv ?? 0),
      totalDescuentos: Number(agg._sum.descuentoTotal ?? 0),
      ticketPromedio: Number(agg._avg.total ?? 0),
      cantidadTransacciones: count,
      topProductos: topProducts.map((t) => ({
        ...productMap.get(t.productId),
        totalVendido: Number(t._sum.cantidad ?? 0),
        totalIngresos: Number(t._sum.total ?? 0),
      })),
    };
  }

  async getDailySeries(businessId: string, month?: number, year?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month !== undefined ? month - 1 : now.getMonth();

    const from = new Date(y, m, 1);
    const to   = new Date(y, m + 1, 0, 23, 59, 59);

    const sales = await this.prisma.sale.findMany({
      where: { businessId, estado: 'activa', fecha: { gte: from, lte: to } },
      select: { fecha: true, total: true },
      orderBy: { fecha: 'asc' },
    });

    // Agrupar por día
    const byDay: Record<string, number> = {};
    for (const s of sales) {
      const day = s.fecha.toISOString().split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + Number(s.total);
    }

    return Object.entries(byDay).map(([date, total]) => ({ date, total }));
  }
}
