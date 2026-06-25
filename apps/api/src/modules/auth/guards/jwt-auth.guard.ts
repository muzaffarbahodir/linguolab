import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import * as Sentry from '@sentry/nestjs';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser extends { id: string; role: string }>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: import('@nestjs/common').ExecutionContext,
  ): TUser {
    if (!err && user) {
      Sentry.setUser({ id: user.id, data: { role: user.role } });
    }
    return super.handleRequest(err, user, info, context);
  }
}
