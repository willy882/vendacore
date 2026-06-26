import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

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
import { ReportsModule }    from './modules/reports/reports.module';
import { ProformasModule }  from './modules/proformas/proformas.module';
import { AuditModule } from './modules/audit/audit.module';
import { BusinessModule } from './modules/business/business.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { PlanEnforcementModule } from './modules/plan-enforcement/plan-enforcement.module';
import { EmailModule } from './modules/email/email.module';

// Guards globales
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

// Filtros e interceptores globales
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { KeepaliveService } from './common/tasks/keepalive.service';
import { TrialExpirationService } from './common/tasks/trial-expiration.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting: máx 60 requests por minuto por IP (login/forgot-password tienen límites propios más estrictos)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    // Habilita decoradores @Cron, @Interval, @Timeout
    ScheduleModule.forRoot(),

    PrismaModule,

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
    ProformasModule,
    AuditModule,
    BusinessModule,
    DocumentsModule,
    SuperAdminModule,
    CryptoModule,
    PlanEnforcementModule,
    EmailModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    KeepaliveService,
    TrialExpirationService,
  ],
})
export class AppModule {}
