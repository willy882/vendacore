import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Base
import { PrismaModule } from './database/prisma.module';

// Módulos del sistema
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { SalesModule } from './modules/sales/sales.module';
import { CashModule } from './modules/cash/cash.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';

// Guards globales
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

// Filtros e interceptores globales
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    // Variables de entorno disponibles en toda la app
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting: máx 60 requests por minuto por IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Base de datos (global: disponible en todos los módulos)
    PrismaModule,

    // Módulos del negocio
    AuthModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SuppliersModule,
    SalesModule,
    CashModule,
    ExpensesModule,
    PurchasesModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
  ],
  providers: [
    // Filtro global de excepciones
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Rate limiting global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // JWT Auth aplicado globalmente (endpoints públicos usan @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Roles aplicado globalmente
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Permisos aplicado globalmente
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // Auditoría aplicada globalmente en operaciones de escritura
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
