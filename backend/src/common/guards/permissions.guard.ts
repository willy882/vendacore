import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException('Sin autenticación');

    // El rol 'administrador' tiene acceso total
    if (user.role?.name === 'administrador') return true;

    const userPermissions: { module: string; action: string }[] =
      user.role?.permissions?.map((rp: any) => rp.permission) ?? [];

    const hasAll = requiredPermissions.every((required) =>
      userPermissions.some(
        (p) => p.module === required.module && p.action === required.action,
      ),
    );

    if (!hasAll) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    return true;
  }
}
