export interface PostIntentCreateResult {
  kind: 'created';
  postId: string;
  activityLegacyId?: number;
  replyText: string;
  createdPost?: import('../presentation/ai-stream-event.view').RecommendedPostCard;
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

export interface PostIntentMatchResult {
  replyText: string;
  matches: Array<{ postId: string; snippet: string; matchReason?: string }>;
  postCards: import('../presentation/ai-stream-event.view').RecommendedPostCard[];
  degraded?: boolean;
  activityLabel?: string;
}
