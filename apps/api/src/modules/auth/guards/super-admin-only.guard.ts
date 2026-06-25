import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * SuperAdminOnlyGuard — только SUPER_ADMIN.
 *
 * Использование:
 *   @UseGuards(JwtAuthGuard, SuperAdminOnlyGuard)
 *   @Patch('/admin/payment-providers/config')
 *   updateProviders() {}
 */
@Injectable()
export class SuperAdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
