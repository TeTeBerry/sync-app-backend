import type { ResolvedChatIntent } from '../../intent/chat-intent.types';
import type { UserProfileSyncResult } from '../../agents/user-profile.agent';
import type { ChatRequestDto } from '../../presentation/chat-request.dto';
import type { ChatMessageDto, AiStreamEvent } from '../../../shared/chat';
import type { ReplySink } from '../../presentation/ai-stream-event.builder';

export interface AiTurnTimings {
  ms_intent?: number;
  ms_profile?: number;
  ms_buddy?: number;
  ms_agent?: number;
  ms_read_only?: number;
}

export interface TurnHandlerContext {
  dto: ChatRequestDto;
  messages: ChatMessageDto[];
  input: string;
  sink: ReplySink;
  routed: ResolvedChatIntent;
  profileSync: UserProfileSyncResult | null;
  timings: AiTurnTimings;
  requestId: string;
  sessionId: string;
}

export interface AgentTurnResult {
  events: AiStreamEvent[];
  timingsPatch?: Pick<AiTurnTimings, 'ms_agent' | 'ms_read_only'>;
}
