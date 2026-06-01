import {
  DEMO_OWNER_USER_ID,
  isDemoOwnerClient,
} from '../utils/demo-owner.util';
import type { RequestActor } from './request-actor.types';

/** Resolve stable Mongo user id from demo query params or explicit userId. */
export function resolveActorUserId(
  userId?: string,
  authorName?: string,
): string {
  const uid = userId?.trim();
  if (isDemoOwnerClient(uid, authorName)) {
    return DEMO_OWNER_USER_ID;
  }
  return uid || DEMO_OWNER_USER_ID;
}

export function resolvedUserIdFromActor(actor: RequestActor): string {
  return actor.resolvedUserId;
}
