import { Injectable, Logger } from '@nestjs/common';
import { ChatAgentOrchestratorService } from '../../agent/chat-agent-orchestrator.service';
import { buildDjInfoSuggestedReplies } from '../../dj/dj-info-suggested-replies.util';
import { DjInfoResolverService } from '../../dj/dj-info-resolver.service';
import { logAiTurn } from '../../utils/log-ai-turn.util';
import { AiStreamEventBuilder } from '../../presentation/ai-stream-event.builder';
import type { ChatAgentTurnResult } from '../../agent/agent.types';
import type { AiStreamEvent } from '../../../shared/chat';
import type {
  AgentFirstTurnResult,
  TurnHandlerContext,
} from './turn-handler.types';

@Injectable()
export class AgentFirstTurnHandler {
  private readonly logger = new Logger(AgentFirstTurnHandler.name);

  constructor(
    private readonly chatAgentOrchestrator: ChatAgentOrchestratorService,
    private readonly djInfoResolver: DjInfoResolverService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async tryRun(ctx: TurnHandlerContext): Promise<AgentFirstTurnResult | null> {
    if (ctx.routed.kind === 'create_post') {
      return null;
    }
    if (
      !this.chatAgentOrchestrator.shouldRunAgentFirst(
        ctx.dto,
        ctx.input,
        ctx.sink.getState(),
      )
    ) {
      return null;
    }

    const agentStartedAt = Date.now();
    const agentResult = await this.chatAgentOrchestrator.runTurn({
      dto: ctx.dto,
      messages: ctx.messages,
      input: ctx.input,
      conversationState: ctx.sink.getState(),
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      legacyIntent: ctx.routed,
    });
    const ms_agent = Date.now() - agentStartedAt;

    if (!agentResult?.replyText) {
      return null;
    }

    logAiTurn(this.logger, {
      event: 'agent_turn',
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      intent: ctx.routed.kind,
      intentSource: 'agent',
      agentTools: agentResult.toolsUsed,
      ms_agent,
    });

    const events = await this.buildAgentReplyEvents(ctx, agentResult);
    return {
      events,
      timingsPatch: { ms_agent },
    };
  }

  private async buildAgentReplyEvents(
    ctx: TurnHandlerContext,
    agentResult: ChatAgentTurnResult,
  ): Promise<AiStreamEvent[]> {
    const replyText = agentResult.replyText;
    ctx.sink.setReply(replyText);
    const events: AiStreamEvent[] = [{ type: 'delta', content: replyText }];

    if (agentResult.toolsUsed.includes('query_dj_info')) {
      const toolCall = agentResult.toolCalls.find(
        (call) => call.name === 'query_dj_info',
      );
      const query = await this.djInfoResolver.resolve({
        messages: ctx.messages,
        input: ctx.input,
        activityLegacyId: ctx.dto.activityLegacyId,
        toolArgs: toolCall?.args,
      });
      const suggested = this.sseBuilder.djInfoSuggestedRepliesEvent(
        buildDjInfoSuggestedReplies({
          query,
          activityLegacyId: ctx.dto.activityLegacyId,
        }),
      );
      if (suggested) {
        events.push(suggested);
      }
    }

    return events;
  }
}
