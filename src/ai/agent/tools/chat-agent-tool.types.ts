import type { ChatAgentTurnInput } from '../agent.types';
import type { AiStreamEvent } from '../../../shared/chat';

export interface ChatAgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatAgentToolExecutionResult {
  ok: boolean;
  content: string;
  data?: Record<string, unknown>;
  error?: string;
  /** Stop the agent loop and emit stream events directly to the client. */
  terminal?: boolean;
  replyOverride?: string;
  streamEvents?: AiStreamEvent[];
}

export interface ChatAgentTool {
  readonly definition: ChatAgentToolDefinition;
  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult>;
}
