import type { RequestActor } from '../../common/auth/request-actor.types';
import type { ConversationState } from '../conversation';
import type { ChatMessageDto } from '../../shared/chat';

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
  actor: RequestActor;
  userPhone?: string;
  image?: string;
  /** When set, chat is scoped to this activity (e.g. opened from event detail). */
  activityLegacyId?: number;
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
