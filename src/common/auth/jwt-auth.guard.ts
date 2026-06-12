import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './auth.constants';
import { AUTH_SESSION_EXPIRED_MESSAGE } from './jwt-bearer.util';
import { jwtBearerToRequestActor } from './resolve-request-actor';
import { AuthService } from '../../modules/auth/auth.service';

const LOGIN_REQUIRED_MESSAGE = '请先登录';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const auth = await this.authService.resolveBearerAuth(
      request.headers.authorization,
    );

    if (auth.kind === 'invalid') {
      throw new UnauthorizedException(AUTH_SESSION_EXPIRED_MESSAGE);
    }

    if (auth.kind === 'valid') {
      request.actor = jwtBearerToRequestActor(auth.actor);
      return true;
    }

    throw new UnauthorizedException(LOGIN_REQUIRED_MESSAGE);
  }
}
