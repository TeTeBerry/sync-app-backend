import { Injectable } from '@nestjs/common';
import type {
  ReplyContext,
  ReplyHandler,
  DeterministicReplyResult,
  AgentToolCall,
  AgentStateProgression,
} from '../../handler-pipeline';
import { HandlerRegistryService } from '../../handler-pipeline/handler-registry.service';
import { AgentToolsService, type AgentToolResult } from './agent-tools.service';
import { ReplyFallbackProvider } from '../reply-fallback.provider';

export interface AgentRuntimeStep {
  handler: string;
  producedReply: boolean;
  plannedToolCalls: AgentToolCall[];
  toolResults: AgentToolResult[];
  stateProgression: AgentStateProgression | null;
}

export interface AgentRuntimeResult {
  result: DeterministicReplyResult;
  steps: AgentRuntimeStep[];
}

/**
 * Rule-based quick reply runtime used by DeterministicReplyService.
 * Posting flow uses BuddyModule use cases instead.
 */
@Injectable()
export class AgentRuntimeService {
  private readonly maxSteps = 4;

  constructor(
    private readonly handlerRegistry: HandlerRegistryService,
    private readonly agentToolsService: AgentToolsService,
    private readonly fallbackProvider: ReplyFallbackProvider,
  ) {}

  async run(ctx: ReplyContext): Promise<AgentRuntimeResult> {
    const steps: AgentRuntimeStep[] = [];

    for (let i = 0; i < this.maxSteps; i += 1) {
      const handler = await this.handlerRegistry.findMatching(ctx);
      if (!handler) break;

      const plannedToolCalls = handler.getPlannedToolCalls?.(ctx) ?? [];
      const stateProgression = handler.getStateProgression?.(ctx) ?? null;
      const toolResults = await this.agentToolsService.executeAll(
        ctx,
        plannedToolCalls,
      );

      const runtimeCtx: ReplyContext = {
        ...ctx,
        plannedToolCalls,
        toolResults,
      };

      const result = await handler.handle(runtimeCtx);
      steps.push({
        handler: handler.id,
        producedReply: Boolean(result),
        plannedToolCalls,
        toolResults,
        stateProgression,
      });

      if (!result) continue;

      return {
        result,
        steps,
      };
    }

    return {
      result: this.fallbackProvider.create(ctx.state),
      steps,
    };
  }
}
