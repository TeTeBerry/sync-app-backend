import { Injectable } from '@nestjs/common';
import type {
  ReplyContext,
  ReplyHandler,
  DeterministicReplyResult,
  AgentToolCall,
  AgentStateProgression,
} from '../handlers';
import { AgentToolsService, type AgentToolResult } from './agent-tools.service';

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

@Injectable()
export class AgentRuntimeService {
  private readonly maxSteps = 4;

  constructor(private readonly agentToolsService: AgentToolsService) {}

  async run(ctx: ReplyContext, handlers: ReplyHandler[]): Promise<AgentRuntimeResult> {
    const steps: AgentRuntimeStep[] = [];

    for (let i = 0; i < this.maxSteps; i += 1) {
      for (const handler of handlers) {
        if (!(await handler.canHandle(ctx))) continue;

        const plannedToolCalls = handler.getPlannedToolCalls?.(ctx) ?? [];
        const stateProgression = handler.getStateProgression?.(ctx) ?? null;
        const toolResults = await this.agentToolsService.executeAll(ctx, plannedToolCalls);

        const runtimeCtx: ReplyContext = {
          ...ctx,
          plannedToolCalls,
          toolResults,
        };

        const result = await handler.handle(runtimeCtx);
        steps.push({
          handler: handler.constructor?.name ?? 'UnknownHandler',
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

      break;
    }

    return {
      result: {
        text: [
          '我可以帮你：找同行搭子、发布出票/收票、查活动或查门票挂单。',
          '请点下方快捷按钮，或直接说需求（如「查 EDC 票」「我有票要出」）。',
        ].join('\n'),
        nextState: ctx.state,
      },
      steps,
    };
  }
}
