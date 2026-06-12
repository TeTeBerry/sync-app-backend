import type { OwnerFilter } from '../utils/owner-filter.util';
import { isResourceOwnedByClient } from '../utils/demo-owner.util';
import { resolveActorUserId } from './actor-user.util';
import type { RequestActor } from './request-actor.types';

/** Build a `RequestActor` from persisted or message fields (not from HTTP middleware). */
export function toRequestActor(
  userId?: string,
  authorName?: string,
): RequestActor {
  const resolvedUserId = resolveActorUserId(userId);
  const hasIdentity = Boolean(resolvedUserId);
  return {
    source: hasIdentity ? 'jwt' : 'anonymous',
    clientUserId: resolvedUserId,
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
  return isResourceOwnedByClient(record, actor.clientUserId, actor.displayName);
}

/** Post ownership: JWT actor, with optional DB profile name when display name drifted. */
export function isPostOwnedByActor(
  post: { userId?: string; authorName?: string },
  actor: RequestActor,
  profileName?: string | null,
): boolean {
  if (isResourceOwnedByActor(post, actor)) {
    return true;
  }
  const name = profileName?.trim();
  if (!name) {
    return false;
  }
  return isResourceOwnedByActor(
    post,
    toRequestActor(actor.resolvedUserId, name),
  );
}
