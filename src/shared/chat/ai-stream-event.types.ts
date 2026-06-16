import type { RecommendedActivityCard } from './chat-cards.types';
import type { ConversationState } from './conversation-state.types';

/** WebSocket AI stream frames (`AiService.streamChat` → client). */
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
