import {
  Controller, Get, Post, Patch, Param, Body,
  Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private service: SalesService) {}

  @Get('payment-methods')
  getPaymentMethods(@CurrentUser() user: any) {
    return this.service.getPaymentMethods(user.businessId);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() user: any,
    @Query('period') period: 'today' | 'week' | 'month' | 'year' = 'today',
  ) {
    return this.service.getSummary(user.businessId, period);
  }

  @Get('daily-series')
  getDailySeries(
    @CurrentUser() user: any,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.service.getDailySeries(user.businessId, month, year);
  }

  /** Historial de cobros realizados — debe ir antes de :id */
  @Get('credit-payment-history')
  getCreditPaymentHistory(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getCreditPaymentHistory(
      user.businessId, page, limit, from, to, search,
    );
  }

  /** Ventas a crédito pendientes — debe ir antes de :id */
  @Get('pending-credit')
  getPendingCredit(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getPendingCredit(user.businessId, page, limit);
  }

  @Get()
  findAll(@Query() query: QuerySaleDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user.businessId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  @Roles('administrador', 'supervisor', 'cajero', 'vendedor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id, user.businessId);
  }

  @Roles('administrador', 'supervisor', 'cajero')
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: any,
  ) {
    return this.service.cancel(id, dto, user.id, user.businessId);
  }

  @Roles('administrador', 'supervisor', 'cajero')
  @Post(':id/credit-payment')
  registerCreditPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { monto: number; paymentMethodId: string; referencia?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.registerCreditPayment(id, body, user.id, user.businessId);
  }

  @Roles('administrador', 'supervisor')
  @Post(':id/return')
  processReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { items: { saleItemId: string; cantidad: number }[]; motivo: string },
    @CurrentUser() user: any,
  ) {
    return this.service.processReturn(id, body, user.id, user.businessId);
  }
}