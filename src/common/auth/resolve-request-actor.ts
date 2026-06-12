import type { Request } from 'express';
import type { JwtBearerActor } from './jwt-bearer.util';
import type { RequestActor } from './request-actor.types';

export function jwtBearerToRequestActor(jwt: JwtBearerActor): RequestActor {
  return {
    source: 'jwt',
    clientUserId: jwt.userId,
    displayName: jwt.userName,
    resolvedUserId: jwt.userId,
  };
}

const ANONYMOUS_ACTOR: RequestActor = {
  source: 'anonymous',
  clientUserId: '',
  displayName: '用户',
  resolvedUserId: '',
};

export function resolveRequestActor(req: Request): RequestActor {
  return req.actor ?? ANONYMOUS_ACTOR;
}
