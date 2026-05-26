import type { ConversationState } from '../conversation';
import type { ChatMessageDto } from '../presentation/chat-message.dto';

export interface DeterministicReplyResult {
  text: string;
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
  plannedToolCalls?: AgentToolCall[];
  toolResults?: AgentToolResultSnapshot[];
}

export interface ReplyMatcher {
  matches(ctx: ReplyContext): boolean | Promise<boolean>;
}

export interface ReplyPlanner {
  plan(ctx: ReplyContext): AgentToolCall[];
}

export interface ReplyExecutor<TResult = unknown> {
  execute(ctx: ReplyContext): Promise<TResult | null>;
}

export interface ReplyComposer<TResult = unknown> {
  compose(ctx: ReplyContext, result: TResult): DeterministicReplyResult;
}

export interface ReplyHandler {
  id: string;
  canHandle(ctx: ReplyContext): boolean | Promise<boolean>;
  handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null>;
  getPlannedToolCalls?(ctx: ReplyContext): AgentToolCall[];
  getStateProgression?(ctx: ReplyContext): AgentStateProgression | null;
}
