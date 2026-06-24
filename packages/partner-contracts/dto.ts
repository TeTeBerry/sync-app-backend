import type { PostRecruitStatus } from './types';

export type CreatePostPayload = {
  body: string;
  activityLegacyId?: number;
  eventTitle?: string;
  location?: string;
  departureCity?: string;
  tags?: string[];
  /** Default true. False = stored but hidden from activity/popular feeds. */
  listedInFeed?: boolean;
  recruitStatus?: PostRecruitStatus;
  slotsTotal?: number;
  slotsFilled?: number;
};

export type UpdatePostPayload = {
  body: string;
  location?: string;
  departureCity?: string;
  tags?: string[];
  recruitStatus?: PostRecruitStatus;
  slotsTotal?: number;
  slotsFilled?: number;
};

export type UpdatePostRecruitPayload = {
  recruitStatus: PostRecruitStatus;
  slotsTotal?: number;
  slotsFilled?: number;
};

export type BuddyPostComposeHints = {
  personalityType?: string;
  favorGenres?: string[];
  setPicks?: string[];
  prefillSummary?: string;
};

export type AiComposePostsPayload = {
  activityLegacyId: number;
  dateStart: string;
  dateEnd: string;
  location: string;
  headcount: string;
  composeHints?: BuddyPostComposeHints;
  regenerate?: boolean;
};

export type CreatePostCommentPayload = {
  body: string;
  parentCommentId?: string;
};

export type PostCommentMutationResult = {
  id: string;
  comments: number;
};

export type DeletePostResult = {
  ok: true;
};
