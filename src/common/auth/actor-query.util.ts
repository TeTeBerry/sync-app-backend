import type { OwnerFilter } from '../utils/owner-filter.util';
import {
  isDemoOwnerClient,
  isResourceOwnedByClient,
} from '../utils/demo-owner.util';
import { resolveActorUserId } from './actor-user.util';
import type { RequestActor } from './request-actor.types';

/** Build a `RequestActor` from persisted or message fields (not from HTTP middleware). */
export function toRequestActor(
  userId?: string,
  authorName?: string,
): RequestActor {
  const resolvedUserId = resolveActorUserId(userId, authorName);
  return {
    source: isDemoOwnerClient(userId, authorName) ? 'demo' : 'jwt',
    clientUserId: userId?.trim() || resolvedUserId,
    displayName: authorName?.trim() || '用户',
    resolvedUserId,
  };
}

export function ownerFilterFromActor(actor: RequestActor): OwnerFilter {
  return {
    userId: actor.clientUserId || undefined,
    authorName: actor.displayName || undefined,
  };
}

export function isResourceOwnedByActor(
  record: { userId?: string; authorName?: string },
  actor: RequestActor,
): boolean {
  return isResourceOwnedByClient(
    record,
    actor.clientUserId,
    actor.displayName,
  );
}
