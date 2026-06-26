import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { ActivateBusinessDto } from './dto/activate-business.dto';
import { UpdateBusinessStatusDto } from './dto/update-status.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('super-admin')
export class SuperAdminController {
  constructor(private service: SuperAdminService) {}

  // ── Overview & Businesses ────────────────────────────────────────────────

  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }

  @Get('businesses')
  getBusinesses() {
    return this.service.getBusinesses();
  }

  @Get('businesses/expiring-soon')
  getExpiringBusinesses() {
    return this.service.getExpiringBusinesses(7);
  }

  @Patch('businesses/:id/sunat')
  updateBusinessSunat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { nubefactToken?: string; sunatMode?: string },
  ) {
    return this.service.updateBusinessSunat(id, dto);
  }

  @Post('businesses/:id/activate')
  activateBusiness(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivateBusinessDto,
  ) {
    return this.service.activateBusiness(id, dto);
  }

  @Delete('businesses/:id')
  deleteBusiness(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteBusiness(id);
  }

  @Post('businesses/:id/renew')
  renewSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { days: number; planId?: string; notas?: string },
  ) {
    return this.service.renewSubscription(id, dto);
  }

  @Patch('businesses/:id/status')
  updateBusinessStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessStatusDto,
  ) {
    return this.service.updateBusinessStatus(id, dto);
  }

  /** Ver contraseña desencriptada de un usuario */
  @Get('users/:id/password')
  getUserPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUserPassword(id);
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  @Get('plans')
  getPlans() {
    return this.service.getPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePlanDto> & { isActive?: boolean },
  ) {
    return this.service.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deletePlan(id);
  }

  /** Validar impacto de cambio de límites ANTES de guardar */
  @Post('plans/:id/validate-change')
  validatePlanChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { maxUsuarios?: number | null; maxProductos?: number | null; maxVentasMes?: number | null; maxDocumentosMes?: number | null },
  ) {
    return this.service.validatePlanChange(id, dto);
  }

  // ── Bóveda de credenciales ───────────────────────────────────────────────

  @Get('credentials')
  getCredentials() {
    return this.service.getCredentials();
  }

  @Post('credentials')
  createCredential(@Body() dto: { servicio: string; url?: string; usuario?: string; password?: string; notas?: string }) {
    return this.service.createCredential(dto);
  }

  @Patch('credentials/:id')
  updateCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { servicio?: string; url?: string; usuario?: string; password?: string; notas?: string },
  ) {
    return this.service.updateCredential(id, dto);
  }

  @Delete('credentials/:id')
  deleteCredential(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCredential(id);
  }

  // ── Recordatorios de pagos ───────────────────────────────────────────────

  @Get('reminders')
  getReminders() {
    return this.service.getReminders();
  }

  @Post('reminders')
  createReminder(@Body() dto: { servicio: string; monto?: number; moneda?: string; diaVencimiento?: number; notas?: string }) {
    return this.service.createReminder(dto);
  }

  @Patch('reminders/:id')
  updateReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { servicio?: string; monto?: number; moneda?: string; diaVencimiento?: number; notas?: string; activo?: boolean },
  ) {
    return this.service.updateReminder(id, dto);
  }

  @Delete('reminders/:id')
  deleteReminder(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteReminder(id);
  }
}
