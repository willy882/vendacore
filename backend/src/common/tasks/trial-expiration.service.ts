import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../modules/email/email.service';

@Injectable()
export class TrialExpirationService implements OnModuleInit {
  private readonly logger = new Logger(TrialExpirationService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async onModuleInit() {
    await this.expireTrials();
  }

  // Cada hora: suspender negocios con trial vencido
  @Cron(CronExpression.EVERY_HOUR)
  async expireTrials() {
    const now = new Date();

    const expired = await this.prisma.businessSubscription.findMany({
      where: {
        estado: 'activo',
        fechaFin: { lt: now },
        business: { status: 'activo', ruc: { not: '00000000000' } },
      },
      include: {
        business: {
          include: {
            users: {
              where: { isActive: true, role: { name: { not: 'super_admin' } } },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { nombre: true, apellido: true, email: true },
            },
          },
        },
        plan: { select: { nombre: true } },
      },
    });

    if (expired.length === 0) return;

    this.logger.warn(`Suspendiendo ${expired.length} negocio(s) por trial vencido`);

    for (const sub of expired) {
      try {
        await this.prisma.$transaction([
          this.prisma.businessSubscription.update({
            where: { id: sub.id },
            data: { estado: 'suspendido', notas: `Trial vencido el ${now.toLocaleDateString('es-PE')}` },
          }),
          this.prisma.business.update({
            where: { id: sub.businessId },
            data: { status: 'suspendido' },
          }),
        ]);

        const nombreNegocio = sub.business.nombreComercial ?? sub.business.razonSocial;
        const contacto      = sub.business.users[0];
        const fechaVencio   = sub.fechaFin
          ? new Date(sub.fechaFin).toLocaleDateString('es-PE')
          : '—';

        this.logger.warn(`Trial suspendido: ${nombreNegocio} (RUC: ${sub.business.ruc})`);

        // Email al admin WCode para follow-up
        this.email.sendTrialExpiredAlert({
          businessName: nombreNegocio,
          ruc:          sub.business.ruc,
          contactName:  contacto ? `${contacto.nombre} ${contacto.apellido}` : '—',
          contactEmail: contacto?.email ?? '—',
          telefono:     sub.business.telefono ?? '',
          fechaVencio,
          planAnterior: sub.plan?.nombre ?? 'Trial gratuito',
        }).catch(() => {});

        // Email al cliente para que sepa que perdió el acceso
        if (contacto) {
          this.email.sendTrialExpiredToClient({
            to:           contacto.email,
            nombre:       contacto.nombre,
            businessName: nombreNegocio,
          }).catch(() => {});
        }

      } catch (err: any) {
        this.logger.error(`Error suspendiendo negocio ${sub.businessId}: ${err.message}`);
      }
    }
  }

  // Cada día a las 13:00 UTC (8:00am Perú): recordatorio 7 días antes del vencimiento
  @Cron('0 13 * * *')
  async sendExpiryReminders() {
    const now        = new Date();
    const in7days    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rangeStart = new Date(in7days);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(in7days);
    rangeEnd.setHours(23, 59, 59, 999);

    const expiringSoon = await this.prisma.businessSubscription.findMany({
      where: {
        estado:  'activo',
        fechaFin: { gte: rangeStart, lte: rangeEnd },
        business: { status: 'activo', ruc: { not: '00000000000' } },
      },
      include: {
        business: {
          include: {
            users: {
              where: { isActive: true, role: { name: { not: 'super_admin' } } },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { nombre: true, email: true },
            },
          },
        },
      },
    });

    if (expiringSoon.length === 0) return;

    this.logger.log(`Enviando recordatorios de vencimiento a ${expiringSoon.length} negocio(s)`);

    for (const sub of expiringSoon) {
      const contacto = sub.business.users[0];
      if (!contacto || !sub.fechaFin) continue;

      const nombreNegocio = sub.business.nombreComercial ?? sub.business.razonSocial;
      const daysLeft = Math.ceil((sub.fechaFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      this.email.sendTrialReminderEmail({
        to:           contacto.email,
        nombre:       contacto.nombre,
        businessName: nombreNegocio,
        daysLeft,
        trialEnd:     sub.fechaFin.toISOString(),
      }).catch(() => {});
    }
  }
}
