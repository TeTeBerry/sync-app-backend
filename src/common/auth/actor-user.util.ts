import type { RequestActor } from './request-actor.types';

/** Resolve stable user id from actor fields (JWT `sub` or persisted userId). */
export function resolveActorUserId(userId?: string): string {
  return userId?.trim() ?? '';
}

export function resolvedUserIdFromActor(actor: RequestActor): string {
  return actor.resolvedUserId;
}
