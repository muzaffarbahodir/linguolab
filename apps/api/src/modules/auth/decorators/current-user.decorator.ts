import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * @CurrentUser() — извлекает req.user (установленный JwtAuthGuard) в параметр контроллера.
 *
 * Использование:
 *   @Get('/users/me')
 *   getMe(@CurrentUser() user: RequestUser) {
 *     return this.usersService.findById(user.id);
 *   }
 *
 * Опционально можно достать конкретное поле:
 *   @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;
    return data ? user[data] : user;
  },
);
