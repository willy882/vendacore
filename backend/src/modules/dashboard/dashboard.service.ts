import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // ── KPIs PRINCIPALES ────────────────────────────────────────────────────

  async getKpis(businessId: string) {
    const now = new Date();

    const startOfToday  = new Date(now); startOfToday.setHours(0,0,0,0);
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear   = new Date(now.getFullYear(), 0, 1);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday);
    endOfYesterday.setMilliseconds(-1);

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const saleWhere = (from: Date, to: Date) => ({
      businessId,
      estado: 'activa' as const,
      fecha: { gte: from, lte: to },
    });

    const [
      ventasHoy,       ventasAyer,
      ventasMes,       ventasUltimoMes,
      ventasAnio,
      gastosMes,
      totalTransHoy,   totalTransMes,
      stockCritico,
      comprobantesPend,
    ] = await Promise.all([
      // Ventas hoy
      this.prisma.sale.aggregate({
        where: saleWhere(startOfToday, now),
        _sum: { total: true }, _count: { id: true },
      }),
      // Ventas ayer
      this.prisma.sale.aggregate({
        where: saleWhere(startOfYesterday, endOfYesterday),
        _sum: { total: true }, _count: { id: true },
      }),
      // Ventas mes actual
      this.prisma.sale.aggregate({
        where: saleWhere(startOfMonth, now),
        _sum: { total: true, igv: true, descuentoTotal: true },
        _avg: { total: true },
        _count: { id: true },
      }),
      // Ventas mes anterior
      this.prisma.sale.aggregate({
        where: saleWhere(startOfLastMonth, endOfLastMonth),
        _sum: { total: true },
      }),
      // Ventas año
      this.prisma.sale.aggregate({
        where: saleWhere(startOfYear, now),
        _sum: { total: true },
        _count: { id: true },
      }),
      // Gastos mes
      this.prisma.expense.aggregate({
        where: { businessId, fecha: { gte: startOfMonth, lte: now } },
        _sum: { monto: true },
      }),
      // Transacciones hoy
      this.prisma.sale.count({ where: saleWhere(startOfToday, now) }),
      // Transacciones mes
      this.prisma.sale.count({ where: saleWhere(startOfMonth, now) }),
      // Productos en stock crítico
      this.prisma.product.findMany({
        where: { businessId, isActive: true },
        select: { id: true, nombre: true, stockActual: true, stockMinimo: true },
      }),
      // Comprobantes pendientes/observados
      this.prisma.electronicDocument.count({
        where: { businessId, estado: { in: ['pendiente', 'observado'] } },
      }),
    ]);

    const ventasHoyTotal     = Number(ventasHoy._sum.total ?? 0);
    const ventasAyerTotal    = Number(ventasAyer._sum.total ?? 0);
    const ventasMesTotal     = Number(ventasMes._sum.total ?? 0);
    const ventasUltMesTotal  = Number(ventasUltimoMes._sum.total ?? 0);
    const ventasAnioTotal    = Number(ventasAnio._sum.total ?? 0);
    const gastosMesTotal     = Number(gastosMes._sum.monto ?? 0);
    const ticketPromedio     = Number(ventasMes._avg.total ?? 0);
    const utilidadBrutaMes   = ventasMesTotal - gastosMesTotal;

    const criticos = stockCritico.filter(
      (p) => Number(p.stockActual) <= Number(p.stockMinimo),
    );

    const pctVentasHoy = ventasAyerTotal > 0
      ? ((ventasHoyTotal - ventasAyerTotal) / ventasAyerTotal) * 100
      : 0;
    const pctVentasMes = ventasUltMesTotal > 0
      ? ((ventasMesTotal - ventasUltMesTotal) / ventasUltMesTotal) * 100
      : 0;

    return {
      ventas: {
        hoy:            { total: ventasHoyTotal,  pctVsAyer: +pctVentasHoy.toFixed(1) },
        mes:            { total: ventasMesTotal,  pctVsAnterior: +pctVentasMes.toFixed(1) },
        anio:           { total: ventasAnioTotal },
        ticketPromedio: +ticketPromedio.toFixed(2),
        igvMes:         Number(ventasMes._sum.igv ?? 0),
        descuentosMes:  Number(ventasMes._sum.descuentoTotal ?? 0),
      },
      transacciones: {
        hoy: totalTransHoy,
        mes: totalTransMes,
      },
      finanzas: {
        gastosMes:      gastosMesTotal,
        utilidadBruta:  +utilidadBrutaMes.toFixed(2),
        margenBruto:    ventasMesTotal > 0
          ? +((utilidadBrutaMes / ventasMesTotal) * 100).toFixed(1)
          : 0,
      },
      alertas: {
        stockCritico:        criticos.length,
        productosStockCritico: criticos.slice(0, 5),
        comprobantesPendientes: comprobantesPend,
      },
    };
  }

  // ── GRÁFICO DE VENTAS POR DÍA ────────────────────────────────────────────

  async getSalesChart(businessId: string, months = 1) {
    const from = new Date();
    from.setMonth(from.getMonth() - (months - 1));
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const sales = await this.prisma.sale.findMany({
      where: { businessId, estado: 'activa', fecha: { gte: from } },
      select: { fecha: true, total: true },
      orderBy: { fecha: 'asc' },
    });

    const byDay: Record<string, number> = {};
    for (const s of sales) {
      const day = s.fecha.toISOString().split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + Number(s.total);
    }

    return Object.entries(byDay).map(([date, total]) => ({ date, total: +total.toFixed(2) }));
  }

  // ── VENTAS VS GASTOS POR MES ─────────────────────────────────────────────

  async getVentasVsGastos(businessId: string, months = 6) {
    const results: { mes: string; ventas: number; gastos: number; utilidad: number }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = from.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });

      const [vAgg, gAgg] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { businessId, estado: 'activa', fecha: { gte: from, lte: to } },
          _sum: { total: true },
        }),
        this.prisma.expense.aggregate({
          where: { businessId, fecha: { gte: from, lte: to } },
          _sum: { monto: true },
        }),
      ]);

      const ventas  = Number(vAgg._sum.total ?? 0);
      const gastos  = Number(gAgg._sum.monto ?? 0);
      results.push({ mes: label, ventas: +ventas.toFixed(2), gastos: +gastos.toFixed(2), utilidad: +(ventas - gastos).toFixed(2) });
    }

    return results;
  }

  // ── TOP PRODUCTOS ────────────────────────────────────────────────────────

  async getTopProducts(businessId: string, limit = 10, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { businessId, estado: 'activa', fecha: { gte: from } } },
      _sum: { cantidad: true, total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const ids = grouped.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, codigoInterno: true, precioVenta: true,
                category: { select: { nombre: true } } },
    });
    const map = new Map(products.map((p) => [p.id, p]));

    return grouped.map((g) => ({
      ...map.get(g.productId),
      cantidadVendida: Number(g._sum.cantidad ?? 0),
      ingresoTotal:    Number(g._sum.total ?? 0),
      transacciones:   g._count.id,
    }));
  }

  // ── VENTAS POR MÉTODO DE PAGO ────────────────────────────────────────────

  async getSalesByPaymentMethod(businessId: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const payments = await this.prisma.salePayment.groupBy({
      by: ['paymentMethodId'],
      where: { sale: { businessId, estado: 'activa', fecha: { gte: from } } },
      _sum: { monto: true },
      _count: { id: true },
      orderBy: { _sum: { monto: 'desc' } },
    });

    const ids = payments.map((p) => p.paymentMethodId);
    const methods = await this.prisma.paymentMethod.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, tipo: true },
    });
    const map = new Map(methods.map((m) => [m.id, m]));

    const total = payments.reduce((a, p) => a + Number(p._sum.monto ?? 0), 0);

    return payments.map((p) => {
      const monto = Number(p._sum.monto ?? 0);
      return {
        ...map.get(p.paymentMethodId),
        monto:          +monto.toFixed(2),
        transacciones:  p._count.id,
        porcentaje:     total > 0 ? +((monto / total) * 100).toFixed(1) : 0,
      };
    });
  }

  // ── ESTADO DE COMPROBANTES SUNAT ─────────────────────────────────────────

  async getDocumentStats(businessId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const grouped = await this.prisma.electronicDocument.groupBy({
      by: ['estado'],
      where: { businessId, createdAt: { gte: startOfMonth } },
      _count: { id: true },
      _sum: { total: true },
    });

    const result: Record<string, { cantidad: number; total: number }> = {};
    for (const g of grouped) {
      result[g.estado] = {
        cantidad: g._count.id,
        total: Number(g._sum.total ?? 0),
      };
    }

    return result;
  }

  // ── FLUJO DE CAJA (últimos N días) ───────────────────────────────────────

  async getCashFlow(businessId: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const movements = await this.prisma.cashMovement.findMany({
      where: { cashSession: { businessId }, fecha: { gte: from } },
      select: { tipo: true, monto: true, fecha: true },
      orderBy: { fecha: 'asc' },
    });

    const byDay: Record<string, { ingresos: number; egresos: number }> = {};
    for (const m of movements) {
      const day = m.fecha.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') byDay[day].ingresos += Number(m.monto);
      else                      byDay[day].egresos  += Number(m.monto);
    }

    let saldoAcumulado = 0;
    return Object.entries(byDay).map(([date, v]) => {
      saldoAcumulado += v.ingresos - v.egresos;
      return {
        date,
        ingresos:         +v.ingresos.toFixed(2),
        egresos:          +v.egresos.toFixed(2),
        saldoAcumulado:   +saldoAcumulado.toFixed(2),
      };
    });
  }

  // ── RANKING DE CLIENTES ──────────────────────────────────────────────────

  async getCustomerRanking(businessId: string, limit = 10) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const grouped = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: { businessId, estado: 'activa', customerId: { not: null }, fecha: { gte: startOfMonth } },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const ids = grouped.map((g) => g.customerId!).filter(Boolean);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombreCompleto: true, numeroDocumento: true, telefono: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      ...map.get(g.customerId!),
      totalCompras:    Number(g._sum.total ?? 0),
      transacciones:   g._count.id,
    }));
  }

  // ── RESUMEN COMPLETO PARA EL DASHBOARD ──────────────────────────────────

  async getFullDashboard(businessId: string) {
    const [kpis, ventasVsGastos, topProductos, porMetodoPago, documentStats, cashFlow, topClientes] =
      await Promise.all([
        this.getKpis(businessId),
        this.getVentasVsGastos(businessId, 6),
        this.getTopProducts(businessId, 5, 30),
        this.getSalesByPaymentMethod(businessId, 30),
        this.getDocumentStats(businessId),
        this.getCashFlow(businessId, 30),
        this.getCustomerRanking(businessId, 5),
      ]);

    return {
      kpis,
      graficos: {
        ventasVsGastos,
        topProductos,
        porMetodoPago,
        cashFlow,
      },
      documentStats,
      topClientes,
      generadoEn: new Date().toISOString(),
    };
  }
}
