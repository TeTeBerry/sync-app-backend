import { Inject, Injectable } from '@nestjs/common';
import type { AgentTool, AgentToolResult } from '../agent-tool.types';
import type { ReplyContext, AgentToolCall } from '../../handler-pipeline';

export type { AgentToolResult } from '../agent-tool.types';
export const AGENT_TOOL_TOKEN = 'AGENT_TOOL_TOKEN';

/**
 * @deprecated No posting tools registered; posting uses BuddyModule use cases.
 * Retained for deterministic reply handler tool execution. See orchestration/README.md.
 */
@Injectable()
export class AgentToolsService {
  private readonly registry = new Map<string, AgentTool>();

  constructor(@Inject(AGENT_TOOL_TOKEN) tools: AgentTool[]) {
    for (const tool of tools) {
      this.registry.set(tool.name, tool);
    }
  }

  all(): AgentTool[] {
    return Array.from(this.registry.values());
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  async executeAll(ctx: ReplyContext, calls: AgentToolCall[]): Promise<AgentToolResult[]> {
    const results: AgentToolResult[] = [];

    for (const call of calls) {
      const tool = this.registry.get(call.tool);
      if (!tool) {
        results.push({ tool: call.tool, ok: false, error: 'tool_not_found' });
        continue;
      }

      try {
        const data = await tool.execute(ctx, call.args);
        results.push({
          tool: call.tool,
          ok: true,
          data: (data ?? {}) as Record<string, unknown>,
        });
      } catch (error) {
        results.push({
          tool: call.tool,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}
