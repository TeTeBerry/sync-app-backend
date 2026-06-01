import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './auth.constants';
import {
  AUTH_SESSION_EXPIRED_MESSAGE,
  classifyBearerAuth,
} from './jwt-bearer.util';
import {
  jwtBearerToRequestActor,
  resolveDemoActorFromQuery,
} from './resolve-request-actor';

const LOGIN_REQUIRED_MESSAGE = '请先登录';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const auth = classifyBearerAuth(
      this.jwtService,
      request.headers.authorization,
    );

    if (auth.kind === 'invalid') {
      throw new UnauthorizedException(AUTH_SESSION_EXPIRED_MESSAGE);
    }

    if (auth.kind === 'valid') {
      request.actor = jwtBearerToRequestActor(auth.actor);
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
