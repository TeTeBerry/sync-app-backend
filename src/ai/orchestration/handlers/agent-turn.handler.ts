import { Injectable, Logger } from '@nestjs/common';
import { ChatAgentOrchestratorService } from '../../agent/chat-agent-orchestrator.service';
import { buildDjInfoSuggestedReplies } from '../../dj/dj-info-suggested-replies.util';
import { DjInfoResolverService } from '../../dj/dj-info-resolver.service';
import { logAiTurn } from '../../utils/log-ai-turn.util';
import { AiStreamEventBuilder } from '../../presentation/ai-stream-event.builder';
import type {
  ChatAgentTurnResult,
  ChatAgentRuntime,
} from '../../agent/agent.types';
import type { AiStreamEvent } from '@sync/chat-contracts';
import type { AgentTurnResult, TurnHandlerContext } from './turn-handler.types';
import { shouldEmitPrepGuidance } from './prep-guidance.util';

/**
 * Phase 1 agent kernel: default chat path via LLM tool loop.
 * Falls back to legacy handlers when agent is disabled or returns no reply.
 */
@Injectable()
export class AgentTurnHandler {
  private readonly logger = new Logger(AgentTurnHandler.name);

  constructor(
    private readonly chatAgentOrchestrator: ChatAgentOrchestratorService,
    private readonly djInfoResolver: DjInfoResolverService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async tryRun(ctx: TurnHandlerContext): Promise<AgentTurnResult | null> {
    if (
      !this.chatAgentOrchestrator.shouldRunAgentFirst(
        ctx.dto,
        ctx.input,
        ctx.sink.getState(),
        ctx.routed,
      )
    ) {
      return null;
    }

    const agentStartedAt = Date.now();
    let replyText = '';
    const runtime: ChatAgentRuntime = {
      getState: () => ctx.sink.getState(),
      setState: (state) => ctx.sink.setState(state),
      setReply: (text) => {
        replyText = text;
        ctx.sink.setReply(text);
      },
      getReply: () => replyText || ctx.sink.getReply(),
    };

    const agentResult = await this.chatAgentOrchestrator.runTurn({
      dto: ctx.dto,
      messages: ctx.messages,
      input: ctx.input,
      conversationState: ctx.sink.getState(),
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      legacyIntent: ctx.routed,
      runtime,
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

    const events: AiStreamEvent[] = agentResult.streamEvents?.length
      ? [...agentResult.streamEvents]
      : [{ type: 'delta', content: replyText }];

    if (!events.some((event) => event.type === 'delta') && replyText.trim()) {
      events.unshift({ type: 'delta', content: replyText });
    }

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

    if (
      shouldEmitPrepGuidance({
        toolsUsed: agentResult.toolsUsed,
        conversationState: ctx.sink.getState(),
        events,
      })
    ) {
      events.push({ type: 'prep_guidance' });
    }

    return events;
  }
}
