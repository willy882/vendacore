import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Prioridad 1: Resend SMTP relay (mejor deliverability, gratis hasta 3k/mes)
    // Para activar: flyctl secrets set RESEND_API_KEY=re_xxx
    const resendKey = process.env.RESEND_API_KEY;

    // Prioridad 2: SMTP genérico (Gmail, etc.)
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (resendKey) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: { user: 'resend', pass: resendKey },
      });
      this.logger.log('Email: usando Resend SMTP relay');
    } else if (host && user && pass && !user.includes('tu_email')) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      this.logger.log('Email: usando SMTP genérico');
    } else {
      this.logger.warn('Email: SMTP no configurado — los emails no se enviarán');
    }
  }

  async sendNewBusinessNotification(data: {
    nombreNegocio: string;
    ruc: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    trialEnds: string;
  }): Promise<boolean> {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (!this.transporter || !adminEmail) return false;

    try {
      const from = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      const fecha = new Date(data.trialEnds).toLocaleDateString('es-PE');
      const waLink = `https://wa.me/${data.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${data.nombre}, te contactamos de VendaCore para ayudarte a configurar tu sistema.`)}`;

      await this.transporter.sendMail({
        from,
        to: adminEmail,
        subject: `🆕 Nuevo registro — ${data.nombreNegocio}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:#1e40af;color:white;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="margin:0;font-size:18px">Nuevo cliente registrado en VendaCore</h2>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.8">${new Date().toLocaleString('es-PE')}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b;width:40%">Negocio</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:bold;color:#0f172a">${data.nombreNegocio}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">RUC</td>
                <td style="padding:12px 16px;font-size:14px;font-family:monospace;color:#0f172a">${data.ruc}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Contacto</td>
                <td style="padding:12px 16px;font-size:14px;color:#0f172a">${data.nombre} ${data.apellido}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Email</td>
                <td style="padding:12px 16px;font-size:14px;color:#2563eb">${data.email}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Teléfono</td>
                <td style="padding:12px 16px;font-size:14px;color:#0f172a">${data.telefono}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Trial vence</td>
                <td style="padding:12px 16px;font-size:14px;color:#d97706;font-weight:600">${fecha}</td>
              </tr>
            </table>

            <div style="margin-top:20px;text-align:center">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
                Contactar por WhatsApp
              </a>
            </div>

            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">
              VendaCore · Panel Super Admin
            </p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando notificación de nuevo negocio: ${err.message}`);
      return false;
    }
  }

  // ── Emails al cliente ─────────────────────────────────────────────────────

  async sendWelcomeEmail(data: {
    to:           string;
    nombre:       string;
    businessName: string;
    trialEnd:     string;
  }): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      const from  = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      const fecha = new Date(data.trialEnd).toLocaleDateString('es-PE');
      const waLink = `https://wa.me/51928141669?text=${encodeURIComponent(`Hola VendaCore, acabo de registrarme con el negocio "${data.businessName}" y quiero saber más sobre los planes.`)}`;

      await this.transporter.sendMail({
        from,
        to: data.to,
        subject: `Bienvenido a VendaCore — ${data.businessName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:#1e40af;color:white;padding:20px 24px;border-radius:8px;margin-bottom:20px;text-align:center">
              <h1 style="margin:0;font-size:22px">Bienvenido a VendaCore</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.85">Tu sistema de gestión comercial</p>
            </div>

            <p style="color:#334155;font-size:15px">Hola <strong>${data.nombre}</strong>,</p>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Tu negocio <strong>${data.businessName}</strong> ya está activo en VendaCore.
              Tienes <strong>30 días de prueba gratuita</strong> para explorar todas las funciones.
            </p>

            <div style="background:white;border-radius:8px;padding:16px 20px;margin:16px 0;border-left:4px solid #2563eb">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b">Tu período de prueba vence el</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#1e40af">${fecha}</p>
            </div>

            <p style="color:#475569;font-size:14px;line-height:1.6">
              Cuando estés listo para continuar, contáctanos y te ayudamos a elegir el plan que mejor se adapte a tu negocio.
            </p>

            <div style="text-align:center;margin-top:20px">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
                Contactar por WhatsApp
              </a>
            </div>

            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px">
              VendaCore · Sistema de Gestión Comercial<br>
              Este correo fue enviado porque registraste tu negocio en nuestra plataforma.
            </p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando bienvenida a ${data.to}: ${err.message}`);
      return false;
    }
  }

  async sendTrialReminderEmail(data: {
    to:           string;
    nombre:       string;
    businessName: string;
    daysLeft:     number;
    trialEnd:     string;
  }): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      const from   = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      const fecha  = new Date(data.trialEnd).toLocaleDateString('es-PE');
      const waLink = `https://wa.me/51928141669?text=${encodeURIComponent(`Hola VendaCore, mi período de prueba de "${data.businessName}" vence en ${data.daysLeft} días (${fecha}) y quiero renovar mi plan.`)}`;
      const urgente = data.daysLeft <= 3;

      await this.transporter.sendMail({
        from,
        to: data.to,
        subject: `${urgente ? '⚠ Urgente — ' : ''}Tu prueba vence en ${data.daysLeft} día${data.daysLeft === 1 ? '' : 's'} — VendaCore`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:${urgente ? '#dc2626' : '#d97706'};color:white;padding:20px 24px;border-radius:8px;margin-bottom:20px;text-align:center">
              <h1 style="margin:0;font-size:20px">${urgente ? 'Tu acceso vence pronto' : 'Recordatorio de vencimiento'}</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.85">VendaCore — ${data.businessName}</p>
            </div>

            <p style="color:#334155;font-size:15px">Hola <strong>${data.nombre}</strong>,</p>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Tu período de prueba en VendaCore termina en <strong>${data.daysLeft} día${data.daysLeft === 1 ? '' : 's'}</strong>, el <strong>${fecha}</strong>.
            </p>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Después de esa fecha, el acceso al sistema se suspenderá hasta que actives un plan de pago.
            </p>

            <div style="background:white;border-radius:8px;padding:16px 20px;margin:16px 0;border-left:4px solid ${urgente ? '#dc2626' : '#d97706'}">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b">Vence el</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:${urgente ? '#dc2626' : '#d97706'}">${fecha}</p>
            </div>

            <p style="color:#475569;font-size:14px;font-weight:600;margin-bottom:8px">Planes disponibles:</p>
            <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden">
              <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 16px;font-size:13px;color:#334155">Básico</td><td style="padding:10px 16px;font-size:13px;font-weight:bold;color:#1e40af;text-align:right">S/. 49 / mes</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 16px;font-size:13px;color:#334155">Profesional</td><td style="padding:10px 16px;font-size:13px;font-weight:bold;color:#1e40af;text-align:right">S/. 89 / mes</td></tr>
              <tr><td style="padding:10px 16px;font-size:13px;color:#334155">Empresarial</td><td style="padding:10px 16px;font-size:13px;font-weight:bold;color:#1e40af;text-align:right">S/. 149 / mes</td></tr>
            </table>

            <div style="text-align:center;margin-top:20px">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
                Renovar por WhatsApp
              </a>
            </div>

            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px">
              VendaCore · Sistema de Gestión Comercial
            </p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando recordatorio a ${data.to}: ${err.message}`);
      return false;
    }
  }

  async sendAccountActivatedEmail(data: {
    to:           string;
    nombre:       string;
    businessName: string;
    planNombre:   string;
    fechaFin:     string;
  }): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      const from  = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      const fecha = new Date(data.fechaFin).toLocaleDateString('es-PE');
      const waLink = `https://wa.me/51928141669?text=${encodeURIComponent(`Hola VendaCore, confirmo que recibí el acceso para "${data.businessName}". Tengo una consulta sobre mi plan.`)}`;

      await this.transporter.sendMail({
        from,
        to: data.to,
        subject: `Tu acceso a VendaCore está activo — ${data.businessName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:#16a34a;color:white;padding:20px 24px;border-radius:8px;margin-bottom:20px;text-align:center">
              <h1 style="margin:0;font-size:20px">Acceso activado</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.85">${data.businessName}</p>
            </div>

            <p style="color:#334155;font-size:15px">Hola <strong>${data.nombre}</strong>,</p>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Tu acceso a VendaCore ha sido activado exitosamente. Ya puedes ingresar al sistema con normalidad.
            </p>

            <div style="background:white;border-radius:8px;padding:16px 20px;margin:16px 0">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:13px;color:#64748b">Plan</span>
                <span style="font-size:14px;font-weight:bold;color:#16a34a">${data.planNombre}</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="font-size:13px;color:#64748b">Acceso hasta</span>
                <span style="font-size:14px;font-weight:bold;color:#334155">${fecha}</span>
              </div>
            </div>

            <p style="color:#475569;font-size:14px;line-height:1.6">
              Si tienes alguna duda o necesitas ayuda, no dudes en contactarnos.
            </p>

            <div style="text-align:center;margin-top:20px">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
                Contactar soporte
              </a>
            </div>

            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px">
              VendaCore · Sistema de Gestión Comercial
            </p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando activación a ${data.to}: ${err.message}`);
      return false;
    }
  }

  async sendTrialExpiredToClient(data: {
    to:           string;
    nombre:       string;
    businessName: string;
  }): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      const from   = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      const waLink = `https://wa.me/51928141669?text=${encodeURIComponent(`Hola VendaCore, mi período de prueba venció para el negocio "${data.businessName}". Quisiera reactivar mi acceso.`)}`;

      await this.transporter.sendMail({
        from,
        to: data.to,
        subject: `Tu acceso a VendaCore ha vencido — ${data.businessName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:#dc2626;color:white;padding:20px 24px;border-radius:8px;margin-bottom:20px;text-align:center">
              <h1 style="margin:0;font-size:20px">Tu período de prueba ha terminado</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.85">${data.businessName}</p>
            </div>

            <p style="color:#334155;font-size:15px">Hola <strong>${data.nombre}</strong>,</p>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Tu período de prueba gratuita en VendaCore ha terminado. El acceso al sistema está
              <strong>temporalmente suspendido</strong>.
            </p>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Para reactivar tu acceso, solo necesitas elegir un plan y realizar el pago.
              El proceso tarda menos de 5 minutos.
            </p>

            <p style="color:#475569;font-size:14px;font-weight:600;margin-bottom:8px">Planes disponibles:</p>
            <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden">
              <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 16px;font-size:13px;color:#334155">Básico</td><td style="padding:10px 16px;font-size:13px;font-weight:bold;color:#1e40af;text-align:right">S/. 49 / mes</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 16px;font-size:13px;color:#334155">Profesional</td><td style="padding:10px 16px;font-size:13px;font-weight:bold;color:#1e40af;text-align:right">S/. 89 / mes</td></tr>
              <tr><td style="padding:10px 16px;font-size:13px;color:#334155">Empresarial</td><td style="padding:10px 16px;font-size:13px;font-weight:bold;color:#1e40af;text-align:right">S/. 149 / mes</td></tr>
            </table>

            <div style="text-align:center;margin-top:20px">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
                Reactivar por WhatsApp
              </a>
            </div>

            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px">
              VendaCore · Sistema de Gestión Comercial
            </p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando vencimiento a ${data.to}: ${err.message}`);
      return false;
    }
  }

  async sendTrialExpiredAlert(data: {
    businessName: string;
    ruc:          string;
    contactName:  string;
    contactEmail: string;
    telefono:     string;
    fechaVencio:  string;
    planAnterior: string;
  }): Promise<boolean> {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (!this.transporter || !adminEmail) return false;

    try {
      const from    = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      const waNum   = data.telefono.replace(/\D/g, '');
      const waLink  = waNum
        ? `https://wa.me/${waNum}?text=${encodeURIComponent(`Hola ${data.contactName}, vemos que tu período de prueba en VendaCore venció el ${data.fechaVencio}. ¿Te gustaría continuar con alguno de nuestros planes?`)}`
        : '';

      await this.transporter.sendMail({
        from,
        to: adminEmail,
        subject: `⚠ Trial vencido — ${data.businessName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:#dc2626;color:white;padding:16px 20px;border-radius:8px;margin-bottom:20px">
              <h2 style="margin:0;font-size:18px">Trial vencido — Negocio suspendido</h2>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.8">${new Date().toLocaleString('es-PE')}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b;width:40%">Negocio</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:bold;color:#0f172a">${data.businessName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">RUC</td>
                <td style="padding:12px 16px;font-size:14px;font-family:monospace;color:#0f172a">${data.ruc}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Contacto</td>
                <td style="padding:12px 16px;font-size:14px;color:#0f172a">${data.contactName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Email</td>
                <td style="padding:12px 16px;font-size:14px;color:#2563eb">${data.contactEmail}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Plan anterior</td>
                <td style="padding:12px 16px;font-size:14px;color:#0f172a">${data.planAnterior}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#64748b">Venció el</td>
                <td style="padding:12px 16px;font-size:14px;color:#dc2626;font-weight:600">${data.fechaVencio}</td>
              </tr>
            </table>

            <p style="margin:16px 0 8px;font-size:13px;color:#475569;font-weight:600">Acción recomendada: contactar para convertir a plan de pago</p>

            ${waLink ? `<div style="margin-top:8px;text-align:center">
              <a href="${waLink}" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
                Contactar por WhatsApp
              </a>
            </div>` : ''}

            <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">
              VendaCore · Sistema automático de expiración de trials
            </p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando alerta de trial vencido: ${err.message}`);
      return false;
    }
  }

  async sendPasswordReset(to: string, nombre: string, resetUrl: string): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    try {
      const from = process.env.SMTP_FROM ?? 'VendaCore <noreply@vendacore.app>';
      await this.transporter.sendMail({
        from,
        to,
        subject: 'Restablecer tu contraseña — VendaCore',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1e40af;margin-bottom:8px">Restablecer contraseña</h2>
            <p style="color:#475569">Hola <strong>${nombre}</strong>,</p>
            <p style="color:#475569">Recibimos una solicitud para restablecer tu contraseña en VendaCore.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
              Restablecer contraseña
            </a>
            <p style="color:#94a3b8;font-size:13px">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
            <p style="color:#94a3b8;font-size:12px">VendaCore — Sistema de Gestión Comercial</p>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando email a ${to}: ${err.message}`);
      return false;
    }
  }
}
