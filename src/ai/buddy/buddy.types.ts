export interface PostIntentCreateResult {
  kind: 'created';
  postId: string;
  activityLegacyId?: number;
  replyText: string;
  createdPost?: import('../../shared/chat').RecommendedPostCard;
}

export interface PostIntentRejectedResult {
  kind: 'rejected';
  replyText: string;
}

export interface PostIntentPendingConfirmationResult {
  kind: 'pending_confirmation';
  replyText: string;
  activityLegacyId?: number;
  draftBody?: string;
}

export interface PostIntentExistingPostResult {
  kind: 'existing_post';
  replyText: string;
  postId: string;
  activityLegacyId?: number;
}

export type PostIntentCreateAttempt =
  | PostIntentCreateResult
  | PostIntentRejectedResult
  | PostIntentPendingConfirmationResult
  | PostIntentExistingPostResult
  | null;
