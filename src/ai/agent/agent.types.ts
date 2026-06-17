import type { ChatMessageDto } from '../../shared/chat';
import type { ConversationState } from '../conversation';
import type { ChatRequestDto } from '../presentation/chat-request.dto';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';
import type { AiStreamEvent } from '../../shared/chat';

export interface ChatAgentRuntime {
  getState: () => ConversationState;
  setState: (state: ConversationState) => void;
  setReply: (text: string) => void;
  getReply: () => string;
}

export interface ChatAgentTurnInput {
  dto: ChatRequestDto;
  messages: ChatMessageDto[];
  input: string;
  conversationState: ConversationState;
  requestId: string;
  sessionId: string;
  legacyIntent: ResolvedChatIntent;
  runtime: ChatAgentRuntime;
}

export interface ChatAgentToolCallRecord {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatAgentTurnResult {
  replyText: string;
  toolsUsed: string[];
  toolCalls: ChatAgentToolCallRecord[];
  steps: number;
  streamEvents?: AiStreamEvent[];
}
