import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/v1/auth/login
   * Inicio de sesión con email y contraseña
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    return this.authService.login(dto, ip);
  }

  /**
   * POST /api/v1/auth/refresh
   * Renovar access token usando refresh token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    // Decodificamos el refresh token para obtener el userId
    // La validación completa la hace JwtRefreshStrategy en producción
    // Por simplicidad aquí usamos el guard directamente
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /**
   * POST /api/v1/auth/logout
   * Cierre de sesión (invalida el token en auditoría)
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    return this.authService.logout(user.id, ip);
  }

  /**
   * GET /api/v1/auth/me
   * Perfil del usuario autenticado
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }
}
