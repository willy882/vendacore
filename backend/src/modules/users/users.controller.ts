import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** GET /api/v1/users/me — Perfil propio */
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id, user.businessId);
  }

  /** PATCH /api/v1/users/me — Actualizar perfil propio */
  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto, user.businessId);
  }

  /** POST /api/v1/users/me/change-password — Cambiar contraseña propia */
  @Post('me/change-password')
  changeOwnPassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changeOwnPassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  /** GET /api/v1/users/all — Lista todos los usuarios de todos los negocios (solo super_admin) */
  @Roles('super_admin')
  @Get('all')
  findAllGlobal() {
    return this.usersService.findAllGlobal();
  }

  /** GET /api/v1/users — Lista todos los usuarios del negocio */
  @Roles('administrador', 'supervisor', 'super_admin')
  @Get()
  findAll(@CurrentUser() user: any) {
    if (user.role?.name === 'super_admin') {
      return this.usersService.findAllGlobal();
    }
    return this.usersService.findAll(user.businessId);
  }

  /** GET /api/v1/users/roles — Lista todos los roles disponibles */
  @Roles('administrador', 'super_admin')
  @Get('roles')
  findRoles() {
    return this.usersService.findRoles();
  }

  /** POST /api/v1/users/in-business/:businessId — Crear usuario en negocio específico (super_admin) */
  @Roles('super_admin')
  @Post('in-business/:businessId')
  createInBusiness(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(dto, businessId);
  }

  /** GET /api/v1/users/:id — Detalle de un usuario */
  @Roles('administrador', 'supervisor')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.usersService.findOne(id, user.businessId);
  }

  /** POST /api/v1/users — Crear nuevo usuario */
  @Roles('administrador')
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.businessId);
  }

  /** PUT /api/v1/users/:id — Actualizar usuario */
  @Roles('administrador', 'super_admin')
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, dto, user.role?.name === 'super_admin' ? null : user.businessId);
  }

  /** PATCH /api/v1/users/:id/deactivate — Desactivar usuario (eliminación lógica) */
  @Roles('administrador')
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.usersService.deactivate(id, user.businessId);
  }

  /** DELETE /api/v1/users/:id — Eliminar usuario permanentemente */
  @Roles('administrador')
  @Delete(':id')
  deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.usersService.deleteUser(id, user.businessId);
  }
}
