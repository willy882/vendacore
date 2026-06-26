import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Res, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProformasService } from './proformas.service';
import { CreateProformaDto, UpdateProformaDto, QueryProformaDto } from './dto/proforma.dto';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador', 'supervisor', 'cajero', 'vendedor', 'contabilidad')
@Controller('proformas')
export class ProformasController {
  constructor(private service: ProformasService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: QueryProformaDto) {
    return this.service.findAll(user.businessId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.businessId, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProformaDto) {
    return this.service.create(user.businessId, user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProformaDto,
  ) {
    return this.service.update(user.businessId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.businessId, id);
  }

  @Get(':id/pdf')
  generatePdf(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: 'a4' | '80mm' | '58mm' = 'a4',
    @Res() res: Response,
  ) {
    return this.service.generatePdf(user.businessId, id, format, res);
  }
}
