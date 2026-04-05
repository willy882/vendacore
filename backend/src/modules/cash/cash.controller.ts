import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { CashService } from './cash.service';
import { OpenCashDto } from './dto/open-cash.dto';
import { CloseCashDto } from './dto/close-cash.dto';
import { AddMovementDto } from './dto/add-movement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private service: CashService) {}

  /** GET /api/v1/cash/active — Sesión de caja activa del usuario */
  @Get('active')
  getActive(@CurrentUser() user: any) {
    return this.service.getActiveSession(user.id, user.businessId);
  }

  /** GET /api/v1/cash/sessions — Historial de sesiones */
  @Roles('administrador', 'supervisor', 'contabilidad')
  @Get('sessions')
  getSessions(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.getSessions(user.businessId, page, limit);
  }

  /** GET /api/v1/cash/:sessionId/arqueo — Arqueo detallado de una sesión */
  @Get(':sessionId/arqueo')
  getArqueo(@Param('sessionId', ParseUUIDPipe) sessionId: string, @CurrentUser() user: any) {
    return this.service.getArqueo(sessionId, user.businessId);
  }

  /** POST /api/v1/cash/open — Abrir caja */
  @Roles('administrador', 'supervisor', 'cajero')
  @Post('open')
  open(@Body() dto: OpenCashDto, @CurrentUser() user: any) {
    return this.service.open(dto, user.id, user.businessId);
  }

  /** POST /api/v1/cash/:sessionId/close — Cerrar caja */
  @Roles('administrador', 'supervisor', 'cajero')
  @Post(':sessionId/close')
  close(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CloseCashDto,
    @CurrentUser() user: any,
  ) {
    return this.service.close(sessionId, dto, user.id, user.businessId);
  }

  /** POST /api/v1/cash/:sessionId/movements — Registrar ingreso o egreso manual */
  @Roles('administrador', 'supervisor', 'cajero')
  @Post(':sessionId/movements')
  addMovement(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: AddMovementDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addMovement(sessionId, dto, user.id, user.businessId);
  }
}
