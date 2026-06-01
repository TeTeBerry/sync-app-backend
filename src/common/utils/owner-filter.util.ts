import type { RequestActor } from '../auth/request-actor.types';
import { ownerFilterFromActor } from '../auth/actor-query.util';

export interface OwnerFilter {
  userId?: string;
  authorName?: string;
}

export function resolveOwnerFilter(
  userId?: string,
  authorName?: string,
): OwnerFilter {
  return {
    userId: userId?.trim() || undefined,
    authorName: authorName?.trim() || undefined,
  };
}

export function resolveOwnerFilterFromActor(actor: RequestActor): OwnerFilter {
  return ownerFilterFromActor(actor);
}
