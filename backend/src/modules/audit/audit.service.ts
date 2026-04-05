import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditFilters {
  modulo?:    string;
  accion?:    string;
  entidad?:   string;
  userId?:    string;
  from?:      string;
  to?:        string;
  search?:    string;
  page?:      number;
  limit?:     number;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // ── Bitácora paginada ─────────────────────────────────────────────────────

  async findAll(businessId: string, filters: AuditFilters) {
    const {
      modulo, accion, entidad, userId,
      from, to, search,
      page = 1, limit = 50,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      businessId,
      ...(modulo  && { modulo }),
      ...(accion  && { accion }),
      ...(entidad && { entidad }),
      ...(userId  && { userId }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to + 'T23:59:59') }),
        },
      }),
      ...(search && {
        OR: [
          { modulo:    { contains: search, mode: 'insensitive' } },
          { accion:    { contains: search, mode: 'insensitive' } },
          { entidad:   { contains: search, mode: 'insensitive' } },
          { entidadId: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search, mode: 'insensitive' } },
          { user: { nombre:   { contains: search, mode: 'insensitive' } } },
          { user: { apellido: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, nombre: true, apellido: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  // ── Detalle de un registro ────────────────────────────────────────────────

  async findOne(id: string, businessId: string) {
    return this.prisma.auditLog.findFirst({
      where: { id, businessId },
      include: {
        user: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
    });
  }

  // ── Estadísticas de auditoría ─────────────────────────────────────────────

  async getStats(businessId: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const [byModule, byAction, byUser, total, timeline] = await Promise.all([
      // Agrupado por módulo
      this.prisma.auditLog.groupBy({
        by: ['modulo'],
        where: { businessId, createdAt: { gte: from } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Agrupado por acción
      this.prisma.auditLog.groupBy({
        by: ['accion'],
        where: { businessId, createdAt: { gte: from } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Top usuarios más activos
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { businessId, createdAt: { gte: from }, userId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Total de registros
      this.prisma.auditLog.count({
        where: { businessId, createdAt: { gte: from } },
      }),

      // Actividad por día (últimos N días)
      this.prisma.auditLog.findMany({
        where: { businessId, createdAt: { gte: from } },
        select: { createdAt: true, accion: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Resolver nombres de usuarios
    const userIds = byUser.map((u) => u.userId!).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true, apellido: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Agrupar timeline por día
    const byDay: Record<string, number> = {};
    for (const t of timeline) {
      const day = t.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    return {
      total,
      periodo: `Últimos ${days} días`,
      porModulo: byModule.map((m) => ({ modulo: m.modulo, cantidad: m._count.id })),
      porAccion:  byAction.map((a) => ({ accion: a.accion, cantidad: a._count.id })),
      usuariosMasActivos: byUser.map((u) => ({
        ...userMap.get(u.userId!),
        cantidad: u._count.id,
      })),
      actividadPorDia: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    };
  }

  // ── Historial de una entidad específica ───────────────────────────────────

  async getEntityHistory(businessId: string, entidad: string, entidadId: string) {
    return this.prisma.auditLog.findMany({
      where: { businessId, entidad, entidadId },
      include: {
        user: { select: { nombre: true, apellido: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Actividad de un usuario ───────────────────────────────────────────────

  async getUserActivity(businessId: string, userId: string, days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    return this.prisma.auditLog.findMany({
      where: { businessId, userId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ── Valores distintos para filtros ────────────────────────────────────────

  async getFilterOptions(businessId: string) {
    const [modulos, acciones, entidades] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { businessId },
        select: { modulo: true },
        distinct: ['modulo'],
        orderBy: { modulo: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { businessId },
        select: { accion: true },
        distinct: ['accion'],
        orderBy: { accion: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { businessId },
        select: { entidad: true },
        distinct: ['entidad'],
        orderBy: { entidad: 'asc' },
      }),
    ]);

    return {
      modulos:  modulos.map((m) => m.modulo),
      acciones: acciones.map((a) => a.accion),
      entidades: entidades.map((e) => e.entidad),
    };
  }
}
