import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';

/**
 * AuditInterceptor
 * Registra automáticamente en audit_logs toda operación de escritura
 * (POST, PUT, PATCH, DELETE) realizada por un usuario autenticado.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // Solo auditar operaciones de escritura
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!writeMethods.includes(method)) return next.handle();

    const user = (request as any).user;
    if (!user) return next.handle(); // endpoint público, no auditar

    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    const userAgent = request.headers['user-agent'] || '';

    // Extraer módulo de la URL: /api/v1/{modulo}/...
    const urlParts = request.url.split('/').filter(Boolean);
    const modulo = urlParts[2] || 'unknown'; // api/v1/{modulo}

    const accionMap: Record<string, string> = {
      POST: 'crear',
      PUT: 'actualizar',
      PATCH: 'actualizar_parcial',
      DELETE: 'eliminar',
    };

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          await this.prisma.auditLog.create({
            data: {
              businessId: user.businessId,
              userId: user.id,
              modulo,
              accion: accionMap[method] || method.toLowerCase(),
              entidad: modulo,
              entidadId: responseData?.id || null,
              datosNuevos: this.sanitize(request.body),
              ipAddress: ip,
              userAgent,
            },
          });
        } catch (error) {
          // La auditoría nunca debe interrumpir el flujo principal
          this.logger.error('Error al registrar auditoría', error);
        }
      }),
    );
  }

  /** Elimina campos sensibles antes de guardar en auditoría */
  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const sensitive = ['password', 'passwordHash', 'newPassword', 'twoFactorSecret', 'token'];
    const clean = { ...data };
    sensitive.forEach((key) => {
      if (key in clean) clean[key] = '[REDACTADO]';
    });
    return clean;
  }
}
