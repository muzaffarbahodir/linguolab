import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

import type { RequestUser } from '../strategies/jwt.strategy';

/** Роли с доступом в админку */
const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER];

/**
 * AdminGuard — проверяет что req.user.role in [ADMIN, SUPER_ADMIN, MANAGER].
 * Применяется для admin-эндпоинтов которые доступны всем ролям выше STUDENT/TEACHER/PARENT.
 *
 * Использование:
 *   @UseGuards(JwtAuthGuard, AdminGuard)
 *   @Get('/admin/students')
 *   getStudents() {}
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user || !ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
