import type { ChatMessageDto } from '../../shared/chat';
import type { ConversationState } from '../conversation';
import type { ChatRequestDto } from '../presentation/chat-request.dto';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';

export type ChatAgentMode = 'off' | 'shadow' | 'on';

export interface ChatAgentTurnInput {
  dto: ChatRequestDto;
  messages: ChatMessageDto[];
  input: string;
  conversationState: ConversationState;
  requestId: string;
  sessionId: string;
  legacyIntent: ResolvedChatIntent;
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
}

export interface ChatAgentShadowComparison {
  legacyIntent: string;
  legacyIntentSource: string;
  agentToolsUsed: string[];
  expectedTools: string[];
  intentToolMatch: boolean;
  agentReplyPreview: string;
  ms_agent: number;
}
