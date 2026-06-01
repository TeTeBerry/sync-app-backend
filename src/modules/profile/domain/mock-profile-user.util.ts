import { resolveActorUserId } from '../../../common/auth/actor-user.util';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import {
  DEMO_OWNER_DISPLAY_NAME,
  DEMO_OWNER_USER_ID,
  isDemoOwnerClient,
} from '../../../common/utils/demo-owner.util';

/** Dev/demo profile identity (Zara seed, demo userId, or default mock author). */
export function isMockProfileUser(
  userId?: string,
  authorName?: string,
): boolean {
  if (isDemoOwnerClient(userId, authorName)) {
    return true;
  }
  const name = authorName?.trim();
  if (!name) {
    return !userId?.trim();
  }
  if (name === 'Zara' || name === DEMO_OWNER_DISPLAY_NAME) {
    return true;
  }
  const first = name.split(/\s+/)[0] ?? '';
  return first === 'Zara';
}

export const MOCK_PROFILE_SEED_USER_ID = DEMO_OWNER_USER_ID;
/** 风暴电音节 深圳站 — matches `activity.seed` legacyId 4. */
export const MOCK_PROFILE_SEED_ACTIVITY_LEGACY_ID = 4;

/** Map Zara / demo profile requests to the seeded demo-zara owner id. */
export function resolveProfilePackageOwnerId(
  userId?: string,
  authorName?: string,
): string {
  if (isMockProfileUser(userId, authorName)) {
    return MOCK_PROFILE_SEED_USER_ID;
  }
  return resolveActorUserId(userId, authorName);
}

export function isMockProfileActor(actor: RequestActor): boolean {
  return isMockProfileUser(actor.clientUserId, actor.displayName);
}

export function resolveProfilePackageOwnerFromActor(
  actor: RequestActor,
): string {
  if (isMockProfileActor(actor)) {
    return MOCK_PROFILE_SEED_USER_ID;
  }
  return actor.resolvedUserId;
}
