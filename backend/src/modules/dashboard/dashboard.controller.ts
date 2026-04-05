import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
@Roles('administrador', 'supervisor', 'contabilidad', 'auditor')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get()
  getFullDashboard(@CurrentUser() user: any) {
    return this.service.getFullDashboard(user.businessId);
  }

  @Get('kpis')
  getKpis(@CurrentUser() user: any) {
    return this.service.getKpis(user.businessId);
  }

  @Get('sales-chart')
  getSalesChart(
    @CurrentUser() user: any,
    @Query('months', new DefaultValuePipe(1), ParseIntPipe) months: number,
  ) {
    return this.service.getSalesChart(user.businessId, months);
  }

  @Get('ventas-vs-gastos')
  getVentasVsGastos(
    @CurrentUser() user: any,
    @Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number,
  ) {
    return this.service.getVentasVsGastos(user.businessId, months);
  }

  @Get('top-products')
  getTopProducts(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getTopProducts(user.businessId, limit, days);
  }

  @Get('payment-methods')
  getSalesByPaymentMethod(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getSalesByPaymentMethod(user.businessId, days);
  }

  @Get('document-stats')
  getDocumentStats(@CurrentUser() user: any) {
    return this.service.getDocumentStats(user.businessId);
  }

  @Get('cash-flow')
  getCashFlow(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getCashFlow(user.businessId, days);
  }

  @Get('customer-ranking')
  getCustomerRanking(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getCustomerRanking(user.businessId, limit);
  }
}
