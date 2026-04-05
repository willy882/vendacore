import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryKardexDto } from './dto/query-kardex.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  /**
   * GET /api/v1/inventory/valorizado
   * Inventario con valor en costo y precio de venta
   */
  @Roles('administrador', 'supervisor', 'almacenero', 'contabilidad')
  @Get('valorizado')
  getValorizado(@CurrentUser() user: any) {
    return this.service.getValorizado(user.businessId);
  }

  /**
   * GET /api/v1/inventory/rotacion?days=30
   * Productos más vendidos en los últimos N días
   */
  @Roles('administrador', 'supervisor', 'contabilidad')
  @Get('rotacion')
  getRotacion(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getRotacion(user.businessId, days);
  }

  /**
   * GET /api/v1/inventory/:productId/kardex
   * Historial de movimientos de un producto
   */
  @Get(':productId/kardex')
  getKardex(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: QueryKardexDto,
    @CurrentUser() user: any,
  ) {
    return this.service.getKardex(productId, query, user.businessId);
  }

  /**
   * POST /api/v1/inventory/adjustments
   * Ajuste manual de stock (entrada o salida)
   */
  @Roles('administrador', 'supervisor', 'almacenero')
  @Post('adjustments')
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
    return this.service.adjustStock(dto, user.id, user.businessId);
  }
}
