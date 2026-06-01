import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { resolveRequestActor } from './resolve-request-actor';
import type { RequestActor } from './request-actor.types';

/** Resolved actor from `JwtAuthGuard` (JWT, or demo query when `AUTH_ALLOW_DEMO=true`). */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestActor => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return resolveRequestActor(req);
  },
);
