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

  /**
   * GET /api/v1/sales/summary?period=today|week|month|year
   * KPIs del período: total ventas, ticket promedio, transacciones
   */
  @Get('summary')
  getSummary(
    @CurrentUser() user: any,
    @Query('period') period: 'today' | 'week' | 'month' | 'year' = 'today',
  ) {
    return this.service.getSummary(user.businessId, period);
  }

  /**
   * GET /api/v1/sales/daily-series?month=4&year=2026
   * Serie de ventas diarias para gráfico de barras
   */
  @Get('daily-series')
  getDailySeries(
    @CurrentUser() user: any,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.service.getDailySeries(user.businessId, month, year);
  }

  /**
   * GET /api/v1/sales
   * Historial de ventas con filtros
   */
  @Get()
  findAll(@Query() query: QuerySaleDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user.businessId);
  }

  /**
   * GET /api/v1/sales/:id
   * Detalle completo de una venta
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  /**
   * POST /api/v1/sales
   * Registrar nueva venta (POS)
   */
  @Roles('administrador', 'supervisor', 'cajero', 'vendedor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id, user.businessId);
  }

  /**
   * PATCH /api/v1/sales/:id/cancel
   * Anular venta con motivo obligatorio
   */
  @Roles('administrador', 'supervisor', 'cajero')
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: any,
  ) {
    return this.service.cancel(id, dto, user.id, user.businessId);
  }
}
