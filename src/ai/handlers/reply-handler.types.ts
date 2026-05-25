import { ChatMessageDto, PindanJoinCardDto, TicketCreatedCardDto } from '../dto/chat.dto';
import type { ConversationState } from '../conversation';

export interface DeterministicReplyResult {
  text: string;
  ticketId?: string;
  ticketCard?: TicketCreatedCardDto;
  pindanCard?: PindanJoinCardDto;
  nextState: ConversationState;
}

export interface AgentToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface AgentToolResultSnapshot {
  tool: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface AgentStateProgression {
  flow: ConversationState['flow'];
  phase?: string;
  summary?: string;
}

export interface ReplyContext {
  messages: ChatMessageDto[];
  input: string;
  state: ConversationState;
  userId?: string;
  userName?: string;
  userPhone?: string;
  image?: string;
  onTicketCreated?: (ticketId: string) => void;
  plannedToolCalls?: AgentToolCall[];
  toolResults?: AgentToolResultSnapshot[];
}

export interface ReplyHandler {
  canHandle(ctx: ReplyContext): boolean | Promise<boolean>;
  handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null>;
  getPlannedToolCalls?(ctx: ReplyContext): AgentToolCall[];
  getStateProgression?(ctx: ReplyContext): AgentStateProgression | null;
}

