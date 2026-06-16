import type { RecommendedActivityCard } from './chat-cards.types';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessageImageContext {
  source?: string;
  ocrText?: string;
}

/** WS / session history message shape (matches `ChatMessageDto`). */
export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  imageContext?: ChatMessageImageContext;
  recommendedActivity?: RecommendedActivityCard;
  suggestedReplies?: string[];
}
