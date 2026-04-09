import {
  Controller, Get, Patch, Post, Param, Body,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business')
export class BusinessController {
  constructor(private service: BusinessService) {}

  /** GET /api/v1/business/me */
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.service.findOne(user.businessId);
  }

  /** PATCH /api/v1/business/me */
  @Roles('administrador')
  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateBusinessDto) {
    return this.service.update(user.businessId, dto);
  }

  /** GET /api/v1/business/payment-methods */
  @Roles('administrador', 'supervisor')
  @Get('payment-methods')
  getPaymentMethods(@CurrentUser() user: any) {
    return this.service.getPaymentMethodsAll(user.businessId);
  }

  /** PATCH /api/v1/business/payment-methods/:id */
  @Roles('administrador')
  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { nombre?: string; isActive?: boolean },
  ) {
    return this.service.updatePaymentMethod(id, user.businessId, body);
  }

  /** POST /api/v1/business/payment-methods */
  @Roles('administrador')
  @Post('payment-methods')
  createPaymentMethod(
    @CurrentUser() user: any,
    @Body() body: { nombre: string; tipo: string },
  ) {
    return this.service.createPaymentMethod(user.businessId, body.nombre, body.tipo);
  }
}