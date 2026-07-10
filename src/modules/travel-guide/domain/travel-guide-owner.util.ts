import type { RequestActor } from '../../../common/auth/request-actor.types';

const PUBLIC_OWNER_PREFIX = 'raven-public';

export function resolveTravelGuideOwnerUserId(
  actor: RequestActor,
  options?: { guideId?: string; fallbackKey?: string },
): string {
  const resolvedUserId = actor.resolvedUserId?.trim();
  if (resolvedUserId) {
    return resolvedUserId;
  }

  const guideId = options?.guideId?.trim();
  if (guideId) {
    return `${PUBLIC_OWNER_PREFIX}:guide:${guideId}`;
  }

  const fallbackKey = options?.fallbackKey?.trim();
  if (fallbackKey) {
    return `${PUBLIC_OWNER_PREFIX}:job:${fallbackKey}`;
  }

  return `${PUBLIC_OWNER_PREFIX}:anonymous`;
}

export function hasAuthenticatedTravelGuideOwner(
  actor: RequestActor | null | undefined,
  ownerUserId: string,
): boolean {
  const resolvedUserId = actor?.resolvedUserId?.trim();
  return Boolean(resolvedUserId) && resolvedUserId === ownerUserId.trim();
}
