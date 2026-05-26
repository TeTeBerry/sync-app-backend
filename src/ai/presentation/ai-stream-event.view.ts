import type { ConversationState } from '../conversation';

export interface RecommendedPostCard {
  postId: string;
  snippet: string;
  authorName: string;
  authorHandle?: string;
  authorAvatar?: string;
  eventTitle: string;
  location?: string;
  tags?: string[];
  activityLegacyId?: number;
  matchReason?: string;
}

export interface BuddyCopyVariantPayload {
  style: 'literary' | 'minimal' | 'direct';
  label: string;
  body: string;
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
      type: 'suggested_replies';
      replies: string[];
    }
  | {
      type: 'buddy_copy_variants';
      variants: BuddyCopyVariantPayload[];
    }
  | {
      type: 'conversation_patch';
      state: ConversationState;
    }
  | { type: 'error'; message: string };
