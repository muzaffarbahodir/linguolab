import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * ActiveUserGuard — пропускает только активированных менеджером пользователей.
 *
 * Новый юзер регистрируется с is_active=false (ждёт подтверждения). JWT всё
 * равно выдаётся (чтобы показать экран "ждёт подтверждения"), поэтому действия
 * с обязательствами (enroll, оплата) нужно отдельно закрыть этим гвардом.
 *
 * Применять ПОСЛЕ JwtAuthGuard (req.user уже заполнен):
 *   @UseGuards(ActiveUserGuard)
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user in request');
    }

    if (!user.is_active) {
      throw new ForbiddenException('Account pending approval');
    }

    return true;
  }
}
