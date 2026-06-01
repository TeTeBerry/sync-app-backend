import type { Request } from 'express';
import type { JwtBearerActor } from './jwt-bearer.util';
import { resolveActorUserId } from './actor-user.util';
import type { RequestActor } from './request-actor.types';

export function jwtBearerToRequestActor(jwt: JwtBearerActor): RequestActor {
  return {
    source: 'jwt',
    clientUserId: jwt.userId,
    displayName: jwt.userName,
    resolvedUserId: jwt.userId,
  };
}

/** Demo / legacy REST: read optional `userId` / `authorName` query params. */
export function resolveDemoActorFromQuery(
  query: Request['query'],
): RequestActor {
  const userId = String(query.userId ?? '').trim();
  const authorName = String(query.authorName ?? '').trim();
  const resolvedUserId = resolveActorUserId(
    userId || undefined,
    authorName || undefined,
  );

  return {
    source: 'demo',
    clientUserId: userId || resolvedUserId,
    displayName: authorName || '用户',
    resolvedUserId,
  };
}

export function resolveRequestActor(req: Request): RequestActor {
  return req.actor ?? resolveDemoActorFromQuery(req.query);
}

/** @deprecated Services accept `RequestActor` directly. */
export function actorToLegacyQuery(actor: RequestActor): {
  userId: string;
  authorName: string;
} {
  return {
    userId: actor.clientUserId,
    authorName: actor.displayName,
  };
}
