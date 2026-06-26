import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PlanEnforcementService } from '../plan-enforcement/plan-enforcement.service';
import { InventoryService } from '../inventory/inventory.service';
import { DocumentsService } from '../documents/documents.service';
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
    private planEnforcement: PlanEnforcementService,
    private inventoryService: InventoryService,
    private documentsService: DocumentsService,
  ) {}

  // ── MÉTODOS DE PAGO ─────────────────────────────────────────────────────

  async getPaymentMethods(businessId: string) {
    const existing = await this.prisma.paymentMethod.findMany({
      where: { businessId, isActive: true },
      select: { id: true, nombre: true, tipo: true },
      orderBy: { nombre: 'asc' },
    });

    // Si el negocio aún no tiene métodos de pago, crearlos automáticamente
    if (existing.length === 0) {
      const defaults = [
        { nombre: 'Efectivo',        tipo: 'efectivo'        },
        { nombre: 'Yape',            tipo: 'yape'            },
        { nombre: 'Plin',            tipo: 'plin'            },
        { nombre: 'Transferencia',   tipo: 'transferencia'   },
        { nombre: 'Tarjeta Débito',  tipo: 'tarjeta_debito'  },
        { nombre: 'Tarjeta Crédito', tipo: 'tarjeta_credito' },
      ] as const;

      await this.prisma.paymentMethod.createMany({
        data: defaults.map((d) => ({
          id:         `${businessId}-${d.tipo}`,
          nombre:     d.nombre,
          tipo:       d.tipo,
          businessId,
          isActive:   true,
        })),
        skipDuplicates: true,
      });

      return this.prisma.paymentMethod.findMany({
        where: { businessId, isActive: true },
        select: { id: true, nombre: true, tipo: true },
        orderBy: { nombre: 'asc' },
      });
    }

    return existing;
  }

  // ── REGISTRAR VENTA ──────────────────────────────────────────────────────

  async create(dto: CreateSaleDto, userId: string, businessId: string) {
    await this.planEnforcement.checkVentas(businessId);

    // 1. Separar items con productId (catálogo) de items libres (sin productId)
    const catalogItems  = dto.items.filter((i) => !!i.productId);

    // Validar productos del catálogo
    let productMap = new Map<string, any>();
    if (catalogItems.length > 0) {
      const productIds = catalogItems.map((i) => i.productId!);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, businessId, isActive: true },
      });
      if (products.length !== productIds.length) {
        const found = products.map((p) => p.id);
        const missing = productIds.filter((id) => !found.includes(id));
        throw new BadRequestException(`Productos no encontrados o inactivos: ${missing.join(', ')}`);
      }
      productMap = new Map(products.map((p) => [p.id, p]));
    }

    // 2. Calcular items
    let subtotal = 0;
    let descuentoTotal = 0;
    let igvTotal = 0;

    const itemsCalc = dto.items.map((item) => {
      const precio = item.precioUnitario;
      const desc   = item.descuento ?? 0;
      const itemSubtotal = (precio - desc) * item.cantidad;

      let igvMonto = 0;
      if (item.productId) {
        const product = productMap.get(item.productId)!;
        if (product.igvTipo === 'gravado') igvMonto = itemSubtotal * IGV_RATE;
      }
      // Free-form items tratados como exonerados (sin IGV)

      subtotal       += itemSubtotal;
      descuentoTotal += desc * item.cantidad;
      igvTotal       += igvMonto;

      return {
        productId:      item.productId ?? null,
        descripcion:    item.descripcion ?? null,
        cantidad:       item.cantidad,
        precioUnitario: precio,
        descuento:      desc,
        subtotal:       itemSubtotal,
        igvMonto,
        total:          itemSubtotal + igvMonto,
      };
    });

    const total = subtotal + igvTotal;

    // 3. Validar stock solo para items de catálogo
    for (const item of catalogItems) {
      const product = productMap.get(item.productId!)!;
      if (Number(product.stockActual) < item.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente para "${product.nombre}". Disponible: ${product.stockActual}, solicitado: ${item.cantidad}`,
        );
      }
    }

    // 4. Resolver paymentMethodIds (acepta ID real o tipo como 'efectivo', 'yape', etc.)
    const resolvedPayments = await Promise.all(
      (dto.payments ?? []).map(async (p) => {
        // Verificar si existe como ID exacto
        const byId = await this.prisma.paymentMethod.findFirst({
          where: { id: p.paymentMethodId, businessId },
        });
        if (byId) return { ...p, paymentMethodId: byId.id };

        // Si no existe, buscarlo por tipo (para los defaults del frontend)
        const byTipo = await this.prisma.paymentMethod.findFirst({
          where: { tipo: p.paymentMethodId as any, businessId },
        });
        if (byTipo) return { ...p, paymentMethodId: byTipo.id };

        // Crear si no existe
        const created = await this.prisma.paymentMethod.create({
          data: {
            id:         `${businessId}-${p.paymentMethodId}`,
            nombre:     p.paymentMethodId.charAt(0).toUpperCase() + p.paymentMethodId.slice(1),
            tipo:       p.paymentMethodId as any,
            businessId,
            isActive:   true,
          },
        });
        return { ...p, paymentMethodId: created.id };
      }),
    );

    // 4b. Validar pagos
    const totalPagado = resolvedPayments.reduce((acc, p) => acc + p.monto, 0);
    if (dto.tipoVenta === 'contado' && resolvedPayments.length > 0 && totalPagado < total) {
      throw new BadRequestException(
        `Pago insuficiente. Total: ${total.toFixed(2)}, pagado: ${totalPagado.toFixed(2)}`,
      );
    }

    const saldoPendiente = Math.max(0, total - totalPagado);
    const montoPagado    = Math.min(totalPagado, total);

    // 5. Buscar sesión de caja activa (si el frontend no la pasó, auto-detectar)
    let effectiveCashSessionId = dto.cashSessionId ?? null;
    if (!effectiveCashSessionId) {
      const activeSession = await this.prisma.cashSession.findFirst({
        where: { businessId, userId, estado: 'abierta' },
        select: { id: true },
      });
      effectiveCashSessionId = activeSession?.id ?? null;
    }

    // 6. Crear venta + descontar stock en una sola transacción (previene race conditions)
    const sale = await this.prisma.$transaction(async (tx) => {
      // 6a. Descuento atómico de stock: el WHERE stockActual >= cantidad garantiza
      //     que si dos requests concurrentes llegan con el último item, solo una gana.
      for (const item of catalogItems) {
        const productName = productMap.get(item.productId!)?.nombre ?? item.productId;
        try {
          await tx.product.update({
            where: {
              id: item.productId!,
              businessId,
              stockActual: { gte: item.cantidad },
            },
            data: { stockActual: { decrement: item.cantidad } },
            select: { id: true },
          });
        } catch (e: any) {
          if (e?.code === 'P2025') {
            throw new BadRequestException(
              `Stock insuficiente para "${productName}". Intente de nuevo.`,
            );
          }
          throw e;
        }
      }

      // 6b. Crear cabecera de venta
      const newSale = await tx.sale.create({
        data: {
          businessId,
          userId,
          customerId: dto.customerId ?? null,
          cashSessionId: effectiveCashSessionId,
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
            create: resolvedPayments.map((p) => ({
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

      // 6c. Registrar movimientos de inventario dentro de la misma transacción
      for (const item of catalogItems) {
        const product = productMap.get(item.productId!)!;
        const stockAnterior = Number(product.stockActual);
        const stockNuevo    = stockAnterior - item.cantidad;
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId:      item.productId!,
            userId,
            tipo:           'salida_venta',
            cantidad:       item.cantidad,
            stockAnterior,
            stockNuevo,
            referenciaId:   newSale.id,
            referenciaTipo: 'sale',
            fecha:          new Date(),
          },
        });
      }

      // 6d. Movimiento de caja si hay sesión abierta
      if (effectiveCashSessionId && montoPagado > 0) {
        const effectivePayment = dto.payments.find((p) => p.monto > 0);
        if (effectivePayment) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: effectiveCashSessionId,
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

      // 6e. Actualizar crédito usado del cliente si es venta a crédito
      if (dto.customerId && dto.tipoVenta === 'credito' && saldoPendiente > 0) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { creditoUsado: { increment: saldoPendiente } },
        });
      }

      return newSale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    this.logger.log(`Venta creada: ${sale.id} | Total: S/ ${total.toFixed(2)} | Usuario: ${userId}`);

    // 7. Emitir comprobante automáticamente si se solicitó
    let comprobante: any = null;
    if (dto.emitirComprobante && dto.tipoComprobante) {
      try {
        comprobante = await this.documentsService.createFromSale(sale.id, dto.tipoComprobante, businessId);
      } catch (err: any) {
        this.logger.warn(`Error al emitir comprobante para venta ${sale.id}: ${err?.message}`);
      }
    }

    return {
      ...sale,
      vuelto: Math.max(0, totalPagado - total),
      ...(comprobante && { comprobante }),
    };
  }

  // ── HISTORIAL ────────────────────────────────────────────────────────────

  async findAll(query: QuerySaleDto, businessId: string) {
    const { from, to, customerId, userId, estado, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const { search } = query;
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
      ...(search && {
        OR: [
          {
            electronicDocuments: {
              some: { numeroCompleto: { contains: search, mode: 'insensitive' } },
            },
          },
          {
            customer: {
              nombreCompleto: { contains: search, mode: 'insensitive' },
            },
          },
        ],
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

      // Revertir movimiento de caja: eliminar el ingreso original
      await tx.cashMovement.deleteMany({
        where: { saleId: id },
      });
    });

    // Revertir stock solo para items con producto de catálogo
    for (const item of sale.items) {
      if (!item.productId) continue;
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

    const productIds = topProducts.map((t) => t.productId).filter((id): id is string => id !== null);
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
        ...(t.productId ? productMap.get(t.productId) : {}),
        totalVendido: Number(t._sum.cantidad ?? 0),
        totalIngresos: Number(t._sum.total ?? 0),
      })),
    };
  }

  // ── COBRAR VENTA A CRÉDITO ───────────────────────────────────────────────

  async registerCreditPayment(
    id: string,
    dto: { monto: number; paymentMethodId: string; referencia?: string },
    _userId: string,
    businessId: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { payments: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.estado === 'anulada') throw new BadRequestException('La venta está anulada');
    if (Number(sale.saldoPendiente) <= 0) throw new BadRequestException('La venta ya está pagada');
    if (dto.monto <= 0 || dto.monto > Number(sale.saldoPendiente)) {
      throw new BadRequestException(`Monto inválido. Saldo pendiente: ${sale.saldoPendiente}`);
    }

    // Resolver método de pago
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, businessId },
    }) ?? await this.prisma.paymentMethod.findFirst({
      where: { tipo: dto.paymentMethodId as any, businessId },
    });
    if (!pm) throw new NotFoundException('Método de pago no encontrado');

    const nuevoSaldo = Number(sale.saldoPendiente) - dto.monto;
    const nuevoMontoPagado = Number(sale.montoPagado) + dto.monto;

    await this.prisma.$transaction(async (tx) => {
      await tx.salePayment.create({
        data: {
          saleId: id,
          paymentMethodId: pm.id,
          monto: dto.monto,
          referencia: dto.referencia ?? null,
          fecha: new Date(),
        },
      });
      await tx.sale.update({
        where: { id },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo <= 0 ? 'activa' : 'pendiente_pago',
        },
      });
      if (sale.customerId && nuevoSaldo <= 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { creditoUsado: { decrement: Number(sale.saldoPendiente) } },
        });
      }
    });

    return { message: 'Pago registrado', saldoPendiente: nuevoSaldo };
  }

  // ── DEVOLUCIÓN PARCIAL ───────────────────────────────────────────────────

  async processReturn(
    id: string,
    dto: { items: { saleItemId: string; cantidad: number }[]; motivo: string },
    userId: string,
    businessId: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: { include: { product: true } } },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.estado === 'anulada') throw new BadRequestException('No se puede devolver una venta anulada');

    // Consultar cantidades ya devueltas previamente (por item de catálogo)
    const prevReturns = await this.prisma.inventoryMovement.findMany({
      where: { referenciaId: id, referenciaTipo: 'sale_return', tipo: 'devolucion', businessId },
      select: { productId: true, cantidad: true },
    });
    const returnedByProduct: Record<string, number> = {};
    for (const m of prevReturns) {
      returnedByProduct[m.productId] = (returnedByProduct[m.productId] ?? 0) + Number(m.cantidad);
    }

    // Validar items — incluye protección contra devoluciones duplicadas
    let montoDevolucion = 0;
    for (const ret of dto.items) {
      const saleItem = sale.items.find((i) => i.id === ret.saleItemId);
      if (!saleItem) throw new BadRequestException(`Item ${ret.saleItemId} no pertenece a esta venta`);
      const nombre = saleItem.product?.nombre ?? saleItem.descripcion ?? 'ítem';
      if (ret.cantidad <= 0) throw new BadRequestException(`Cantidad inválida para "${nombre}"`);

      const originalQty = Number(saleItem.cantidad);
      const alreadyReturned = saleItem.productId ? (returnedByProduct[saleItem.productId] ?? 0) : 0;
      if (alreadyReturned + ret.cantidad > originalQty) {
        const disponible = originalQty - alreadyReturned;
        throw new BadRequestException(
          `"${nombre}": solo quedan ${disponible} unidad(es) disponibles para devolver (ya se devolvieron ${alreadyReturned})`,
        );
      }
      montoDevolucion += Number(saleItem.precioUnitario) * ret.cantidad;
    }

    // Buscar sesión de caja activa del usuario para registrar egreso
    const cashSession = await this.prisma.cashSession.findFirst({
      where: { businessId, userId, estado: 'abierta' },
    });

    await this.prisma.$transaction(async (tx) => {
      // Registrar movimientos de inventario (restaurar stock)
      for (const ret of dto.items) {
        const saleItem = sale.items.find((i) => i.id === ret.saleItemId)!;
        if (!saleItem.productId) continue;
        await this.inventoryService.registerMovement({
          businessId,
          productId: saleItem.productId,
          userId,
          tipo: 'devolucion',
          cantidad: ret.cantidad,
          referenciaId: sale.id,
          referenciaTipo: 'sale_return',
          observaciones: `Devolución: ${dto.motivo}`,
        });
      }

      // Registrar egreso en caja si hay sesión abierta
      if (cashSession && montoDevolucion > 0) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: cashSession.id,
            userId,
            saleId: sale.id,
            tipo: 'egreso',
            concepto: `Devolución venta — ${dto.motivo}`,
            monto: montoDevolucion,
            fecha: new Date(),
          },
        });
      }

      // Auditoría
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          modulo: 'ventas',
          accion: 'devolucion',
          entidad: 'sale',
          entidadId: sale.id,
          datosNuevos: { items: dto.items, motivo: dto.motivo, montoDevolucion },
        },
      });
    });

    this.logger.log(`Devolución procesada para venta ${id} — monto S/.${montoDevolucion.toFixed(2)} — caja: ${cashSession ? 'sí' : 'sin sesión activa'}`);
    return {
      message: 'Devolución registrada y stock actualizado',
      saleId: id,
      montoDevolucion,
      cajaActualizada: !!cashSession,
    };
  }

  // ── VENTAS PENDIENTES DE COBRO ───────────────────────────────────────────

  async getPendingCredit(businessId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { businessId, estado: 'pendiente_pago' as any };
    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, nombreCompleto: true, numeroDocumento: true, telefono: true } },
          user: { select: { id: true, nombre: true, apellido: true } },
          payments: { include: { paymentMethod: { select: { nombre: true } } } },
          items: { include: { product: { select: { nombre: true } } } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── HISTORIAL DE COBROS ──────────────────────────────────────────────────

  async getCreditPaymentHistory(
    businessId: string,
    page = 1,
    limit = 20,
    from?: string,
    to?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(to + 'T23:59:59');

    const where: any = {
      sale: { businessId },
      ...(Object.keys(dateFilter).length ? { fecha: dateFilter } : {}),
      ...(search ? {
        sale: {
          businessId,
          customer: {
            nombreCompleto: { contains: search, mode: 'insensitive' },
          },
        },
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.salePayment.findMany({
        where,
        include: {
          paymentMethod: { select: { nombre: true, tipo: true } },
          sale: {
            select: {
              id: true,
              total: true,
              saldoPendiente: true,
              customer: { select: { id: true, nombreCompleto: true, numeroDocumento: true } },
              user: { select: { nombre: true, apellido: true } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.salePayment.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
