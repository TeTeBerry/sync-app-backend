import type { ConversationState } from '../conversation';

export type RecommendedPostAuthorGender = 'female' | 'male';

export interface RecommendedPostCard {
  postId: string;
  snippet: string;
  authorName: string;
  authorHandle?: string;
  authorAvatar?: string;
  authorGender?: RecommendedPostAuthorGender;
  eventTitle: string;
  location?: string;
  tags?: string[];
  activityLegacyId?: number;
  matchReason?: string;
}

export interface RecommendedActivityCard {
  activityLegacyId: number;
  title: string;
  date?: string;
  venue?: string;
}

export type AiStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'message_complete';
      content: string;
      requestId?: string;
    }
  | {
      type: 'done';
      messageId?: string;
      sessionId?: string;
    }
  | {
      type: 'post_created';
      postId: string;
      activityLegacyId?: number;
      post?: RecommendedPostCard;
    }
  | {
      type: 'existing_post';
      postId: string;
      activityLegacyId?: number;
    }
  | {
      type: 'post_recommendations';
      posts: RecommendedPostCard[];
      degraded?: boolean;
    }
  | {
      type: 'activity_recommendation';
      activity: RecommendedActivityCard;
    }
  | {
      type: 'suggested_replies';
      replies: string[];
    }
  | {
      type: 'conversation_patch';
      state: ConversationState;
    }
  | { type: 'error'; message: string };
