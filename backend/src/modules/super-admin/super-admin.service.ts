import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { PlanEnforcementService } from '../plan-enforcement/plan-enforcement.service';
import { EmailService } from '../email/email.service';
import { ActivateBusinessDto } from './dto/activate-business.dto';
import { UpdateBusinessStatusDto } from './dto/update-status.dto';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private planEnforcement: PlanEnforcementService,
    private email: EmailService,
  ) {}

  async getOverview() {
    const exclude = { ruc: { not: '00000000000' } };
    const [total, activos, pendientes, suspendidos] = await Promise.all([
      this.prisma.business.count({ where: exclude }),
      this.prisma.business.count({ where: { status: 'activo',     ...exclude } }),
      this.prisma.business.count({ where: { status: 'pendiente',  ...exclude } }),
      this.prisma.business.count({ where: { status: 'suspendido', ...exclude } }),
    ]);
    return { total, activos, pendientes, suspendidos };
  }

  async getBusinesses() {
    return this.prisma.business.findMany({
      where: { ruc: { not: '00000000000' } },
      include: {
        subscription: { include: { plan: true } },
        users: {
          where: { role: { name: { not: 'super_admin' } } },
          select: {
            id: true, email: true, nombre: true, apellido: true,
            isActive: true, createdAt: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, nombre: true, apellido: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      email: user.email,
      nombre: `${user.nombre} ${user.apellido}`,
      password: null, // Las contraseñas se almacenan como hash bcrypt, no son recuperables
    };
  }

  async activateBusiness(businessId: string, dto: ActivateBusinessDto) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        users: {
          where: { isActive: true, role: { name: { not: 'super_admin' } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { nombre: true, email: true },
        },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const fechaInicio = new Date();
    const fechaFin    = new Date();
    fechaFin.setDate(fechaFin.getDate() + (dto.duracionDias ?? 30));

    const notasPago = [
      dto.notas,
      dto.metodoPago    ? `Método: ${dto.metodoPago}`       : null,
      dto.referenciaPago ? `Ref: ${dto.referenciaPago}`     : null,
    ].filter(Boolean).join(' | ') || null;

    await this.prisma.$transaction([
      this.prisma.businessSubscription.upsert({
        where:  { businessId },
        update: {
          planId:       dto.planId ?? null,
          estado:       'activo',
          fechaInicio,
          fechaFin,
          montoPagado:  dto.montoPagado ?? 0,
          notas:        notasPago,
          updatedAt:    new Date(),
        },
        create: {
          businessId,
          planId:      dto.planId ?? null,
          estado:      'activo',
          fechaInicio,
          fechaFin,
          montoPagado: dto.montoPagado ?? 0,
          notas:       notasPago,
        },
      }),
      this.prisma.business.update({
        where: { id: businessId },
        data:  { status: 'activo' },
      }),
      this.prisma.user.updateMany({
        where: { businessId, role: { name: { not: 'super_admin' } } },
        data:  { isActive: true },
      }),
    ]);

    // Email de confirmación al cliente (no bloquea)
    const contacto    = business.users[0];
    const planNombre  = dto.planId
      ? (await this.prisma.plan.findUnique({ where: { id: dto.planId }, select: { nombre: true } }))?.nombre ?? 'Plan activado'
      : 'Trial extendido';

    if (contacto) {
      this.email.sendAccountActivatedEmail({
        to:           contacto.email,
        nombre:       contacto.nombre,
        businessName: business.nombreComercial ?? business.razonSocial,
        planNombre,
        fechaFin:     fechaFin.toISOString(),
      }).catch(() => {});
    }

    return { message: 'Negocio activado correctamente' };
  }

  async updateBusinessStatus(businessId: string, dto: UpdateBusinessStatusDto) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        users: {
          where: { role: { name: { not: 'super_admin' } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { nombre: true, email: true },
        },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const deactivate = dto.status === 'suspendido' || dto.status === 'cancelado';

    const ops: any[] = [
      this.prisma.business.update({
        where: { id: businessId },
        data: { status: dto.status as any },
      }),
    ];

    if (deactivate) {
      ops.push(
        this.prisma.user.updateMany({
          where: { businessId, role: { name: { not: 'super_admin' } } },
          data: { isActive: false },
        }),
      );
    }

    if (business.status !== dto.status) {
      ops.push(
        this.prisma.businessSubscription.upsert({
          where: { businessId },
          update: { estado: dto.status as any, notas: dto.notas ?? null, updatedAt: new Date() },
          create: { businessId, estado: dto.status as any, notas: dto.notas ?? null },
        }),
      );
    }

    await this.prisma.$transaction(ops);

    // Notificar al cliente si se suspende o cancela manualmente
    if (deactivate && business.status !== dto.status) {
      const contacto      = business.users[0];
      const nombreNegocio = business.nombreComercial ?? business.razonSocial;
      if (contacto) {
        this.email.sendTrialExpiredToClient({
          to:           contacto.email,
          nombre:       contacto.nombre,
          businessName: nombreNegocio,
        }).catch(() => {});
      }
    }

    return { message: `Estado del negocio actualizado a ${dto.status}` };
  }

  // ── Plans ──────────────────────────────────────────────────────────────────

  async getPlans() {
    return this.prisma.plan.findMany({ orderBy: { precio: 'asc' } });
  }

  async createPlan(dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        nombre:          dto.nombre,
        descripcion:     dto.descripcion,
        precio:          dto.precio,
        duracionDias:    dto.duracionDias ?? 30,
        maxUsuarios:     dto.maxUsuarios     ?? null,
        maxProductos:    dto.maxProductos    ?? null,
        maxVentasMes:    dto.maxVentasMes    ?? null,
        maxDocumentosMes: dto.maxDocumentosMes ?? null,
      },
    });
  }

  async updatePlan(id: string, dto: Partial<CreatePlanDto> & { isActive?: boolean }) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.nombre          !== undefined && { nombre:           dto.nombre }),
        ...(dto.descripcion     !== undefined && { descripcion:      dto.descripcion }),
        ...(dto.precio          !== undefined && { precio:           dto.precio }),
        ...(dto.duracionDias    !== undefined && { duracionDias:     dto.duracionDias }),
        ...(dto.isActive        !== undefined && { isActive:         dto.isActive }),
        ...(dto.maxUsuarios      !== undefined && { maxUsuarios:      dto.maxUsuarios ?? null }),
        ...(dto.maxProductos     !== undefined && { maxProductos:     dto.maxProductos ?? null }),
        ...(dto.maxVentasMes     !== undefined && { maxVentasMes:     dto.maxVentasMes ?? null }),
        ...(dto.maxDocumentosMes !== undefined && { maxDocumentosMes: dto.maxDocumentosMes ?? null }),
      },
    });
  }

  async deletePlan(id: string) {
    await this.prisma.plan.delete({ where: { id } });
    return { message: 'Plan eliminado' };
  }

  async updateBusinessSunat(businessId: string, dto: { nubefactToken?: string; sunatMode?: string }) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');
    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.nubefactToken !== undefined && { nubefactToken: dto.nubefactToken || null }),
        ...(dto.sunatMode !== undefined && { sunatMode: dto.sunatMode as any }),
      },
      select: { id: true, razonSocial: true, nubefactToken: true, sunatMode: true },
    });
  }

  async deleteBusiness(businessId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');
    if (biz.ruc === '00000000000') {
      throw new BadRequestException('No se puede eliminar el negocio interno del sistema');
    }

    // Eliminar en orden correcto para respetar FK sin cascade
    // 1. Registros hoja que no tienen cascade desde sus padres
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM electronic_documents WHERE "businessId" = $1`, businessId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM inventory_movements WHERE "businessId" = $1`, businessId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM cash_movements WHERE "cashSessionId" IN (SELECT id FROM cash_sessions WHERE "businessId" = $1)`, businessId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM sale_payments WHERE "saleId" IN (SELECT id FROM sales WHERE "businessId" = $1)`, businessId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM sale_items WHERE "saleId" IN (SELECT id FROM sales WHERE "businessId" = $1)`, businessId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM purchase_items WHERE "purchaseId" IN (SELECT id FROM purchases WHERE "businessId" = $1)`, businessId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM proforma_items WHERE "proformaId" IN (SELECT id FROM proformas WHERE "businessId" = $1)`, businessId,
    );

    // 2. Registros principales con FK a otras entidades del negocio
    await this.prisma.$executeRawUnsafe(`DELETE FROM cash_sessions WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM sales WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM purchases WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM proformas WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM expenses WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM audit_logs WHERE "businessId" = $1`, businessId);

    // 3. Catálogos del negocio
    await this.prisma.$executeRawUnsafe(`DELETE FROM products WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM customers WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM suppliers WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM payment_methods WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM expense_categories WHERE "businessId" = $1`, businessId);
    // Categorías de producto tienen auto-referencia (parentId); limpiar antes de borrar
    await this.prisma.$executeRawUnsafe(
      `UPDATE product_categories SET "parentId" = NULL WHERE "businessId" = $1`, businessId,
    );
    await this.prisma.$executeRawUnsafe(`DELETE FROM product_categories WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM document_series WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM business_subscriptions WHERE "businessId" = $1`, businessId);

    // 4. Usuarios y finalmente el negocio
    await this.prisma.$executeRawUnsafe(`DELETE FROM users WHERE "businessId" = $1`, businessId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM businesses WHERE id = $1`, businessId);

    return { message: `Negocio "${biz.razonSocial}" eliminado permanentemente.` };
  }

  async renewSubscription(businessId: string, dto: { days: number; planId?: string; notas?: string }) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');

    const sub = await this.prisma.businessSubscription.findUnique({ where: { businessId } });
    const now = new Date();

    // Si ya hay suscripción: extender desde hoy o desde la fecha fin (lo que sea mayor)
    const baseDate = sub?.fechaFin && new Date(sub.fechaFin) > now ? new Date(sub.fechaFin) : now;
    const nuevaFin = new Date(baseDate);
    nuevaFin.setDate(nuevaFin.getDate() + dto.days);

    const planId = dto.planId ?? sub?.planId ?? null;

    if (sub) {
      await this.prisma.businessSubscription.update({
        where: { businessId },
        data: {
          estado: 'activo',
          fechaInicio: now,
          fechaFin: nuevaFin,
          ...(planId !== undefined && { planId }),
          notas: dto.notas ?? `Renovado por ${dto.days} días`,
        },
      });
    } else {
      await this.prisma.businessSubscription.create({
        data: {
          businessId,
          planId,
          estado: 'activo',
          fechaInicio: now,
          fechaFin: nuevaFin,
          notas: dto.notas ?? `Activado por ${dto.days} días`,
        },
      });
    }

    // Activar el negocio si estaba suspendido/cancelado
    if (biz.status !== 'activo') {
      await this.prisma.business.update({ where: { id: businessId }, data: { status: 'activo' } });
    }

    return {
      message: `Suscripción renovada hasta ${nuevaFin.toLocaleDateString('es-PE')}`,
      fechaFin: nuevaFin.toISOString(),
    };
  }

  async getExpiringBusinesses(days = 7) {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    return this.prisma.businessSubscription.findMany({
      where: {
        estado: 'activo',
        fechaFin: { gte: now, lte: threshold },
      },
      include: {
        business: { select: { id: true, razonSocial: true, nombreComercial: true, ruc: true, status: true } },
        plan: { select: { nombre: true, precio: true } },
      },
      orderBy: { fechaFin: 'asc' },
    });
  }

  async validatePlanChange(planId: string, nuevosLimites: {
    maxUsuarios?: number | null;
    maxProductos?: number | null;
    maxVentasMes?: number | null;
    maxDocumentosMes?: number | null;
  }) {
    return this.planEnforcement.validatePlanChange(planId, nuevosLimites);
  }

  // ── Admin Credentials (Bóveda) ─────────────────────────────────────────────

  async getCredentials() {
    const rows = await this.prisma.adminCredential.findMany({ orderBy: { servicio: 'asc' } });
    return rows.map((c) => ({
      ...c,
      passwordDecrypted: this.crypto.safeDecrypt(c.passwordEncrypted),
      passwordEncrypted: undefined,
    }));
  }

  async createCredential(dto: { servicio: string; url?: string; usuario?: string; password?: string; notas?: string }) {
    return this.prisma.adminCredential.create({
      data: {
        servicio: dto.servicio,
        url: dto.url,
        usuario: dto.usuario,
        passwordEncrypted: dto.password ? this.crypto.encrypt(dto.password) : null,
        notas: dto.notas,
      },
    }).then((c) => ({ ...c, passwordDecrypted: dto.password ?? '', passwordEncrypted: undefined }));
  }

  async updateCredential(id: string, dto: { servicio?: string; url?: string; usuario?: string; password?: string; notas?: string }) {
    const existing = await this.prisma.adminCredential.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Credencial no encontrada');
    const updated = await this.prisma.adminCredential.update({
      where: { id },
      data: {
        ...(dto.servicio !== undefined && { servicio: dto.servicio }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.usuario !== undefined && { usuario: dto.usuario }),
        ...(dto.password !== undefined && { passwordEncrypted: dto.password ? this.crypto.encrypt(dto.password) : null }),
        ...(dto.notas !== undefined && { notas: dto.notas }),
      },
    });
    return { ...updated, passwordDecrypted: this.crypto.safeDecrypt(updated.passwordEncrypted), passwordEncrypted: undefined };
  }

  async deleteCredential(id: string) {
    await this.prisma.adminCredential.delete({ where: { id } });
    return { message: 'Credencial eliminada' };
  }

  // ── Payment Reminders ──────────────────────────────────────────────────────

  async getReminders() {
    return this.prisma.paymentReminder.findMany({ orderBy: [{ activo: 'desc' }, { diaVencimiento: 'asc' }] });
  }

  async createReminder(dto: { servicio: string; monto?: number; moneda?: string; diaVencimiento?: number; notas?: string }) {
    return this.prisma.paymentReminder.create({
      data: {
        servicio: dto.servicio,
        monto: dto.monto,
        moneda: dto.moneda ?? 'USD',
        diaVencimiento: dto.diaVencimiento,
        notas: dto.notas,
      },
    });
  }

  async updateReminder(id: string, dto: { servicio?: string; monto?: number; moneda?: string; diaVencimiento?: number; notas?: string; activo?: boolean }) {
    const existing = await this.prisma.paymentReminder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Recordatorio no encontrado');
    return this.prisma.paymentReminder.update({ where: { id }, data: dto as any });
  }

  async deleteReminder(id: string) {
    await this.prisma.paymentReminder.delete({ where: { id } });
    return { message: 'Recordatorio eliminado' };
  }
}
