import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * RolesGuard — проверяет что req.user.role входит в список @Roles(...)
 *
 * Использование (всегда после JwtAuthGuard):
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 *   @Delete('/admin/users/:id')
 *   deleteUser() {}
 *
 * Если @Roles не задан → пропускаем (гвард только ограничивает, не требует).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Если декоратора @Roles нет — любая роль проходит
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user in request');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
