import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OpenCashDto } from './dto/open-cash.dto';
import { CloseCashDto } from './dto/close-cash.dto';
import { AddMovementDto } from './dto/add-movement.dto';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private prisma: PrismaService) {}

  // ── APERTURA ─────────────────────────────────────────────────────────────

  async open(dto: OpenCashDto, userId: string, businessId: string) {
    const sessionAbierta = await this.prisma.cashSession.findFirst({
      where: { businessId, userId, estado: 'abierta' },
    });
    if (sessionAbierta) {
      throw new BadRequestException(
        'Ya tienes una sesión de caja abierta. Ciérrala antes de abrir una nueva.',
      );
    }

    const session = await this.prisma.cashSession.create({
      data: {
        businessId,
        userId,
        montoApertura: dto.montoApertura,
        fechaApertura: new Date(),
        estado: 'abierta',
        observaciones: dto.observaciones ?? null,
      },
      include: {
        user: { select: { nombre: true, apellido: true } },
      },
    });

    this.logger.log(`Caja abierta: session=${session.id} user=${userId} monto=${dto.montoApertura}`);
    return session;
  }

  // ── CIERRE ───────────────────────────────────────────────────────────────

  async close(sessionId: string, dto: CloseCashDto, userId: string, businessId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, businessId, estado: 'abierta' },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada o ya cerrada');

    // Calcular totales del sistema
    const movements = await this.prisma.cashMovement.findMany({
      where: { cashSessionId: sessionId },
    });

    const totalIngresos = movements
      .filter((m) => m.tipo === 'ingreso')
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const totalEgresos = movements
      .filter((m) => m.tipo === 'egreso')
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const montoCierreSistema = Number(session.montoApertura) + totalIngresos - totalEgresos;
    const diferencia = dto.montoCierreReal - montoCierreSistema;

    const closed = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        estado: 'cerrada',
        fechaCierre: new Date(),
        montoCierreSistema,
        montoCierreReal: dto.montoCierreReal,
        diferencia,
        observaciones: dto.observaciones ?? session.observaciones,
      },
    });

    this.logger.log(
      `Caja cerrada: session=${sessionId} sistema=${montoCierreSistema} ` +
      `real=${dto.montoCierreReal} diferencia=${diferencia}`,
    );

    // Resumen por método de pago
    const ventasMoves = await this.prisma.cashMovement.findMany({
      where: { cashSessionId: sessionId, tipo: 'ingreso' },
      include: { paymentMethod: { select: { nombre: true, tipo: true } } },
    });

    const porMetodo: Record<string, number> = {};
    for (const m of ventasMoves) {
      const key = m.paymentMethod?.nombre ?? 'Sin método';
      porMetodo[key] = (porMetodo[key] ?? 0) + Number(m.monto);
    }

    return {
      session: closed,
      resumen: {
        montoApertura: Number(session.montoApertura),
        totalIngresos,
        totalEgresos,
        montoCierreSistema,
        montoCierreReal: dto.montoCierreReal,
        diferencia,
        porMetodoPago: porMetodo,
      },
    };
  }

  // ── SESIÓN ACTIVA ─────────────────────────────────────────────────────────

  async getActiveSession(userId: string, businessId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { businessId, userId, estado: 'abierta' },
      include: {
        user: { select: { nombre: true, apellido: true } },
        movements: {
          orderBy: { fecha: 'desc' },
          take: 50,
          include: { paymentMethod: { select: { nombre: true } } },
        },
      },
    });
    if (!session) return null;

    // Calcular saldo actual
    const totalIngresos = session.movements
      .filter((m) => m.tipo === 'ingreso')
      .reduce((acc, m) => acc + Number(m.monto), 0);
    const totalEgresos = session.movements
      .filter((m) => m.tipo === 'egreso')
      .reduce((acc, m) => acc + Number(m.monto), 0);

    return {
      ...session,
      saldoActual: Number(session.montoApertura) + totalIngresos - totalEgresos,
      totalIngresos,
      totalEgresos,
    };
  }

  // ── MOVIMIENTOS ───────────────────────────────────────────────────────────

  async addMovement(sessionId: string, dto: AddMovementDto, userId: string, businessId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, businessId, estado: 'abierta' },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada o ya cerrada');

    return this.prisma.cashMovement.create({
      data: {
        cashSessionId: sessionId,
        userId,
        tipo: dto.tipo as any,
        concepto: dto.concepto,
        monto: dto.monto,
        paymentMethodId: dto.paymentMethodId ?? null,
        fecha: new Date(),
      },
      include: { paymentMethod: { select: { nombre: true } } },
    });
  }

  // ── HISTORIAL DE SESIONES ─────────────────────────────────────────────────

  async getSessions(businessId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where: { businessId },
        include: {
          user: { select: { nombre: true, apellido: true } },
          _count: { select: { movements: true, sales: true } },
        },
        orderBy: { fechaApertura: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cashSession.count({ where: { businessId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── ARQUEO ────────────────────────────────────────────────────────────────

  async getArqueo(sessionId: string, businessId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, businessId },
      include: {
        movements: {
          include: { paymentMethod: { select: { nombre: true, tipo: true } } },
          orderBy: { fecha: 'asc' },
        },
        sales: {
          where: { estado: 'activa' },
          select: { id: true, total: true, fecha: true },
        },
        user: { select: { nombre: true, apellido: true } },
      },
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');

    const ingresos = session.movements.filter((m) => m.tipo === 'ingreso');
    const egresos  = session.movements.filter((m) => m.tipo === 'egreso');

    const totalIngresos = ingresos.reduce((a, m) => a + Number(m.monto), 0);
    const totalEgresos  = egresos.reduce((a, m) => a + Number(m.monto), 0);
    const saldoSistema  = Number(session.montoApertura) + totalIngresos - totalEgresos;

    const porMetodo: Record<string, number> = {};
    for (const m of ingresos) {
      const k = m.paymentMethod?.nombre ?? 'Otros';
      porMetodo[k] = (porMetodo[k] ?? 0) + Number(m.monto);
    }

    return {
      session: {
        id: session.id,
        usuario: `${session.user.nombre} ${session.user.apellido}`,
        fechaApertura: session.fechaApertura,
        fechaCierre: session.fechaCierre,
        estado: session.estado,
      },
      montoApertura: Number(session.montoApertura),
      totalIngresos,
      totalEgresos,
      saldoSistema,
      totalVentas: session.sales.reduce((a, s) => a + Number(s.total), 0),
      cantidadVentas: session.sales.length,
      porMetodoPago: porMetodo,
      movimientos: session.movements,
    };
  }
}
