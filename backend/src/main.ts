import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');

async function bootstrap() {
  // Validar variables de entorno críticas antes de arrancar
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('❌ JWT_SECRET es requerido y debe tener al menos 32 caracteres');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('❌ DATABASE_URL es requerida');
  }

  const app = await NestFactory.create(AppModule);

  // Aumentar límite de body para imágenes en base64
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ limit: '5mb', extended: true }));

  // Compresión gzip (reduce tamaño de respuestas ~70%)
  app.use(compression());

  // Seguridad: headers HTTP seguros
  app.use(helmet());

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // CORS — soporta múltiples orígenes separados por coma
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origen (apps móviles, Postman, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origen no permitido: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Elimina propiedades no declaradas en DTO
      forbidNonWhitelisted: true, // Rechaza requests con propiedades extra
      transform: true,           // Transforma tipos automáticamente
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 VendaCore API corriendo en: http://0.0.0.0:${port}/api/v1`);
}
bootstrap();
