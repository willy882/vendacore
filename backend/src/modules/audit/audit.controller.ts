import {
  Controller, Get, Param, Query,
  ParseUUIDPipe, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('audit')
@Roles('administrador', 'auditor')
export class AuditController {
  constructor(private service: AuditService) {}

  // GET /audit — bitácora paginada con filtros
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('modulo')  modulo?:  string,
    @Query('accion')  accion?:  string,
    @Query('entidad') entidad?: string,
    @Query('userId')  userId?:  string,
    @Query('from')    from?:    string,
    @Query('to')      to?:      string,
    @Query('search')  search?:  string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page?:  number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.service.findAll(user.businessId, {
      modulo, accion, entidad, userId, from, to, search, page, limit,
    });
  }

  // GET /audit/stats — resumen estadístico
  @Get('stats')
  getStats(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getStats(user.businessId, days);
  }

  // GET /audit/filters — opciones disponibles para los filtros del frontend
  @Get('filters')
  getFilterOptions(@CurrentUser() user: any) {
    return this.service.getFilterOptions(user.businessId);
  }

  // GET /audit/entity/:entidad/:entidadId — historial de una entidad
  @Get('entity/:entidad/:entidadId')
  getEntityHistory(
    @CurrentUser() user: any,
    @Param('entidad')   entidad:   string,
    @Param('entidadId') entidadId: string,
  ) {
    return this.service.getEntityHistory(user.businessId, entidad, entidadId);
  }

  // GET /audit/user/:userId — actividad de un usuario
  @Get('user/:userId')
  getUserActivity(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getUserActivity(user.businessId, userId, days);
  }

  // GET /audit/:id — detalle de un registro
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.findOne(id, user.businessId);
  }
}
