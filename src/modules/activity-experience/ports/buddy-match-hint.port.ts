import type { RequestActor } from '../../../common/auth/request-actor.types';

export type BuddyMatchHintCriteria = {
  activityLegacyId: number;
  activityName?: string;
  profileFavorGenres: string[];
};

export type BuddyMatchHintSearchItem = {
  postId: string;
};

export interface IBuddyMatchHintPort {
  searchPosts(params: {
    criteria: BuddyMatchHintCriteria;
    actor: RequestActor;
    limit: number;
  }): Promise<{ items: BuddyMatchHintSearchItem[] }>;
}

export const BUDDY_MATCH_HINT_PORT = Symbol('BUDDY_MATCH_HINT_PORT');
