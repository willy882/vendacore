import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface PlanLimits {
  maxUsuarios?:      number | null;
  maxProductos?:     number | null;
  maxVentasMes?:     number | null;
  maxDocumentosMes?: number | null;
}

export interface AffectedBusiness {
  id:           string;
  nombre:       string;
  ruc:          string;
  uso:          number;
  limiteActual: number | null;
  limiteNuevo:  number;
}

@Injectable()
export class PlanEnforcementService {
  constructor(private prisma: PrismaService) {}

  // ── Obtener plan activo del negocio ───────────────────────────────────────

  private async getPlan(businessId: string): Promise<PlanLimits | null> {
    const sub = await this.prisma.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });
    if (!sub?.plan) return null;
    return sub.plan;
  }

  // ── Uso actual ─────────────────────────────────────────────────────────────

  private async currentUsage(businessId: string) {
    const now    = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [usuarios, productos, ventasMes, docsMes] = await Promise.all([
      this.prisma.user.count({
        where: { businessId, isActive: true, role: { name: { not: 'super_admin' } } },
      }),
      this.prisma.product.count({ where: { businessId, isActive: true } }),
      this.prisma.sale.count({
        where: { businessId, estado: { not: 'anulada' }, fecha: { gte: inicio, lte: fin } },
      }),
      this.prisma.electronicDocument.count({
        where: { businessId, fechaEmision: { gte: inicio, lte: fin } },
      }),
    ]);

    return { usuarios, productos, ventasMes, docsMes };
  }

  // ── Checks individuales ────────────────────────────────────────────────────

  async checkUsuarios(businessId: string) {
    const plan = await this.getPlan(businessId);
    if (!plan || plan.maxUsuarios == null) return;
    const { usuarios } = await this.currentUsage(businessId);
    if (usuarios >= plan.maxUsuarios) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${plan.maxUsuarios} usuario(s) de tu plan. Actualiza tu suscripción para agregar más.`,
      );
    }
  }

  async checkProductos(businessId: string) {
    const plan = await this.getPlan(businessId);
    if (!plan || plan.maxProductos == null) return;
    const { productos } = await this.currentUsage(businessId);
    if (productos >= plan.maxProductos) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${plan.maxProductos} producto(s) de tu plan. Actualiza tu suscripción para agregar más.`,
      );
    }
  }

  async checkVentas(businessId: string) {
    const plan = await this.getPlan(businessId);
    if (!plan || plan.maxVentasMes == null) return;
    const { ventasMes } = await this.currentUsage(businessId);
    if (ventasMes >= plan.maxVentasMes) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${plan.maxVentasMes} venta(s) este mes de tu plan. Actualiza tu suscripción.`,
      );
    }
  }

  async checkDocumentos(businessId: string) {
    const plan = await this.getPlan(businessId);
    if (!plan || plan.maxDocumentosMes == null) return;
    const { docsMes } = await this.currentUsage(businessId);
    if (docsMes >= plan.maxDocumentosMes) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${plan.maxDocumentosMes} documento(s) SUNAT este mes de tu plan. Actualiza tu suscripción.`,
      );
    }
  }

  // ── Uso completo para dashboard ────────────────────────────────────────────

  async getUsage(businessId: string) {
    const [plan, usage] = await Promise.all([
      this.getPlan(businessId),
      this.currentUsage(businessId),
    ]);
    return {
      plan,
      uso: usage,
    };
  }

  // ── Validar cambio de plan (antes de guardar) ──────────────────────────────
  // Devuelve los negocios afectados que superarían el nuevo límite

  async validatePlanChange(planId: string, nuevosLimites: PlanLimits): Promise<{
    afectados: {
      campo: string;
      label: string;
      limiteNuevo: number;
      negocios: AffectedBusiness[];
    }[];
  }> {
    // Negocios que tienen este plan activo
    const subs = await this.prisma.businessSubscription.findMany({
      where: { planId, estado: 'activo' },
      include: { business: { select: { id: true, razonSocial: true, nombreComercial: true, ruc: true } } },
    });

    if (subs.length === 0) return { afectados: [] };

    const afectados: { campo: string; label: string; limiteNuevo: number; negocios: AffectedBusiness[] }[] = [];

    const limites: { campo: keyof PlanLimits; label: string; usoCampo: 'usuarios' | 'productos' | 'ventasMes' | 'docsMes' }[] = [
      { campo: 'maxUsuarios',      label: 'Usuarios activos',     usoCampo: 'usuarios'   },
      { campo: 'maxProductos',     label: 'Productos activos',    usoCampo: 'productos'  },
      { campo: 'maxVentasMes',     label: 'Ventas este mes',      usoCampo: 'ventasMes'  },
      { campo: 'maxDocumentosMes', label: 'Documentos SUNAT/mes', usoCampo: 'docsMes'    },
    ];

    for (const { campo, label, usoCampo } of limites) {
      const nuevoLimite = nuevosLimites[campo];
      if (nuevoLimite == null) continue; // ilimitado → no hay problema

      const negociosAfectados: AffectedBusiness[] = [];

      for (const sub of subs) {
        const uso = await this.currentUsage(sub.business.id);
        const usoActual = uso[usoCampo];
        if (usoActual > nuevoLimite) {
          negociosAfectados.push({
            id:           sub.business.id,
            nombre:       sub.business.nombreComercial ?? sub.business.razonSocial,
            ruc:          sub.business.ruc,
            uso:          usoActual,
            limiteActual: null,
            limiteNuevo:  nuevoLimite,
          });
        }
      }

      if (negociosAfectados.length > 0) {
        afectados.push({ campo, label, limiteNuevo: nuevoLimite, negocios: negociosAfectados });
      }
    }

    return { afectados };
  }
}
