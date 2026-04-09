import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { SunatService } from './sunat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private service: DocumentsService,
    private sunatService: SunatService,
  ) {}

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.service.getStats(user.businessId);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.service.findAll(user.businessId, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.businessId);
  }

  @Roles('administrador', 'supervisor', 'cajero')
  @Post('from-sale')
  createFromSale(
    @Body() body: { saleId: string; tipo: 'boleta' | 'factura' },
    @CurrentUser() user: any,
  ) {
    return this.service.createFromSale(body.saleId, body.tipo, user.businessId);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { estado: string },
    @CurrentUser() user: any,
  ) {
    return this.service.updateStatus(id, body.estado, user.businessId);
  }

  /** POST /api/v1/documents/:id/send-sunat — Enviar comprobante a SUNAT via Nubefact */
  @Roles('administrador', 'supervisor', 'cajero')
  @Post(':id/send-sunat')
  sendToSunat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.sunatService.sendDocument(id, user.businessId);
  }
}