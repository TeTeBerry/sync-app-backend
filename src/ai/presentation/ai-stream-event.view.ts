import type { ConversationState } from '../../shared/chat/conversation-state.types';
import type {
  RecommendedActivityCard,
  RecommendedPostCard,
} from '../../shared/chat/chat-cards.types';

export type {
  RecommendedActivityCard,
  RecommendedPostAuthorGender,
  RecommendedPostCard,
} from '../../shared/chat/chat-cards.types';

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
