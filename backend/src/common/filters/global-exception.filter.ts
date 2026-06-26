import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || message;
        // Errores de validación de class-validator
        if (Array.isArray(resp.message)) {
          errors = resp.message;
          message = 'Error de validación';
        }
      }
    } else if (
      exception instanceof Error &&
      'code' in exception &&
      typeof (exception as any).code === 'string' &&
      /^P\d{4}$/.test((exception as any).code)
    ) {
      // Errores conocidos de Prisma → respuestas HTTP legibles
      const prismaErr = exception as Error & { code: string };
      switch (prismaErr.code) {
        case 'P2002':
          status  = HttpStatus.CONFLICT;
          message = 'Ya existe un registro con ese valor. Verifica los campos únicos.';
          break;
        case 'P2025':
          status  = HttpStatus.NOT_FOUND;
          message = 'El registro solicitado no existe.';
          break;
        case 'P2003':
          status  = HttpStatus.BAD_REQUEST;
          message = 'Referencia inválida: el registro relacionado no existe.';
          break;
        case 'P2034':
          status  = HttpStatus.CONFLICT;
          message = 'Conflicto de concurrencia. Intente la operación nuevamente.';
          break;
        default:
          this.logger.error(`Prisma error ${prismaErr.code}: ${prismaErr.message}`);
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Error no controlado: ${exception.message}`,
        exception.stack,
      );
    }

    // En producción no exponer detalles internos
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      process.env.NODE_ENV === 'production'
    ) {
      message = 'Error interno del servidor';
      errors = null;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors && { errors }),
    });
  }
}
