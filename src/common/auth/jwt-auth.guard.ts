import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './auth.constants';
import { AUTH_SESSION_EXPIRED_MESSAGE } from './jwt-bearer.util';
import {
  jwtBearerToRequestActor,
  resolveDemoActorFromQuery,
} from './resolve-request-actor';
import { AuthService } from '../../modules/auth/auth.service';
import { resolveClientIpFromRequest } from '../http/resolve-client-ip.util';

const LOGIN_REQUIRED_MESSAGE = '请先登录';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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
      const actor = jwtBearerToRequestActor(auth.actor);
      request.actor = actor;
      await this.authService.assertActorAllowedToUseApp(
        actor,
        resolveClientIpFromRequest(request),
      );
      return true;
    }

    if (this.isDemoQueryAllowed()) {
      request.actor = resolveDemoActorFromQuery(request.query);
      return true;
    }

    throw new UnauthorizedException(LOGIN_REQUIRED_MESSAGE);
  }

  private isDemoQueryAllowed(): boolean {
    return this.configService.get<boolean>('auth.allowDemoQuery') === true;
  }
}
