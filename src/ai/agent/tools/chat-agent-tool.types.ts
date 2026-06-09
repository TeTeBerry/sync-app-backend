import type { ChatAgentTurnInput } from '../agent.types';

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
}

export interface ChatAgentTool {
  readonly definition: ChatAgentToolDefinition;
  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult>;
}
