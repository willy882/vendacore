import {
  Controller, Get, Post, Put, Patch,
  Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private service: SuppliersService) {}

  @Get('deudas')
  @Roles('administrador', 'supervisor', 'contabilidad')
  getDeudas(@CurrentUser() user: any) {
    return this.service.getDeudas(user.businessId);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.service.findAll(user.businessId, search);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  @Post()
  @Roles('administrador', 'supervisor', 'almacenero')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.businessId);
  }

  @Put(':id')
  @Roles('administrador', 'supervisor', 'almacenero')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.businessId);
  }

  @Patch(':id/deactivate')
  @Roles('administrador')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.deactivate(id, user.businessId);
  }
}
