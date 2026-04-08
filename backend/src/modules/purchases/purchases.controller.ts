import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private service: PurchasesService) {}

  @Get('pending-payments')
  @Roles('administrador', 'supervisor', 'contabilidad')
  getPending(@CurrentUser() user: any) {
    return this.service.getPendingPayments(user.businessId);
  }

  @Get()
  @Roles('administrador', 'supervisor', 'almacenero', 'contabilidad')
  findAll(
    @CurrentUser() user: any,
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(user.businessId, { supplierId, from, to, page, limit });
  }

  @Get(':id')
  @Roles('administrador', 'supervisor', 'almacenero', 'contabilidad')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  @Post()
  @Roles('administrador', 'supervisor', 'almacenero')
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id, user.businessId);
  }

  @Patch(':id/mark-paid')
  @Roles('administrador', 'supervisor', 'contabilidad')
  markAsPaid(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.markAsPaid(id, user.businessId);
  }

  @Delete(':id')
  @Roles('administrador')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.businessId);
  }
}
