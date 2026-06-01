import type { ReplyContext } from '../handler-pipeline';

/**
 * Contract for a single agent tool that can be executed by the runtime.
 * Each tool encapsulates its own name, execution logic, and error handling.
 */
export interface AgentTool {
  /** Unique tool identifier, e.g. 'post.create' */
  readonly name: string;
  /** Execute the tool with the given context and arguments */
  execute(
    ctx: ReplyContext,
    args?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | void>;
}

/**
 * Result returned after executing an AgentTool.
 */
export interface AgentToolResult {
  tool: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
