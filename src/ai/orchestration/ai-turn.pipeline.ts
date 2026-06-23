import { Injectable, Logger } from '@nestjs/common';
import { IntentRouterService } from '../intent/intent-router.service';
import {
  UserProfileAgent,
  type UserProfileSyncResult,
} from '../agents/user-profile.agent';
import { mustForceCreatePostIntent } from '../policy/chat-turn-policy';
import { AgentTurnHandler } from './handlers/agent-turn.handler';
import { ReadOnlyTurnHandler } from './handlers/read-only-turn.handler';
import { LegacyTurnHandler } from './handlers/legacy-turn.handler';
import type {
  AiTurnTimings,
  TurnHandlerContext,
} from './handlers/turn-handler.types';
import { logAiTurn } from '../utils/log-ai-turn.util';
import { ChatRequestDto } from '../presentation/chat-request.dto';
import { ChatMessageDto } from '@sync/chat-contracts';
import type { AiStreamEvent } from '@sync/chat-contracts';
import { type ReplySink } from '../presentation/ai-stream-event.builder';
import type { ConversationState } from '../conversation';

export type { AiTurnTimings } from './handlers/turn-handler.types';

export interface AiTurnResult {
  events: AiStreamEvent[];
  assistantReply: string;
  conversationState: ConversationState;
  intent?: string;
  timings: AiTurnTimings;
}

@Injectable()
export class AiTurnPipeline {
  private readonly logger = new Logger(AiTurnPipeline.name);

  constructor(
    private readonly userProfileAgent: UserProfileAgent,
    private readonly intentRouter: IntentRouterService,
    private readonly agentTurnHandler: AgentTurnHandler,
    private readonly readOnlyTurnHandler: ReadOnlyTurnHandler,
    private readonly legacyTurnHandler: LegacyTurnHandler,
  ) {}

  async runTurn(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    initialState: ConversationState,
    requestId: string,
    sessionId: string,
  ): Promise<AiTurnResult> {
    let assistantReply = '';
    let conversationState = initialState;

    const sink: ReplySink = {
      setReply: (text) => {
        assistantReply = text;
      },
      getReply: () => assistantReply,
      setState: (state) => {
        conversationState = state;
      },
      getState: () => conversationState,
    };

    const timings: AiTurnTimings = {};

    const intentStartedAt = Date.now();
    const forceCreatePostIntent = mustForceCreatePostIntent(
      lastInput,
      conversationState,
      fullMessages,
    );

    const routed = forceCreatePostIntent
      ? { kind: 'create_post' as const, source: 'rule' as const }
      : await this.intentRouter.resolve({
          messages: fullMessages,
          input: lastInput,
          activityLegacyId: dto.activityLegacyId,
          image: dto.image,
          sessionId,
          requestId,
          conversationState: initialState,
        });
    timings.ms_intent = Date.now() - intentStartedAt;

    logAiTurn(this.logger, {
      event: 'intent_resolved',
      requestId,
      sessionId,
      intent: routed.kind,
      intentSource: routed.source,
      ms_intent: timings.ms_intent,
    });

    const handlerCtx: TurnHandlerContext = {
      dto,
      messages: fullMessages,
      input: lastInput,
      sink,
      routed,
      profileSync: null,
      timings,
      requestId,
      sessionId,
    };

    const readOnlyTurn = await this.readOnlyTurnHandler.tryRun(handlerCtx);
    if (readOnlyTurn) {
      if (readOnlyTurn.timingsPatch?.ms_read_only != null) {
        timings.ms_read_only = readOnlyTurn.timingsPatch.ms_read_only;
      }
      return {
        events: readOnlyTurn.events,
        assistantReply: sink.getReply(),
        conversationState: sink.getState(),
        intent: routed.kind,
        timings,
      };
    }

    const agentTurn = await this.agentTurnHandler.tryRun(handlerCtx);
    if (agentTurn) {
      if (agentTurn.timingsPatch?.ms_agent != null) {
        timings.ms_agent = agentTurn.timingsPatch.ms_agent;
      }
      return {
        events: agentTurn.events,
        assistantReply: sink.getReply(),
        conversationState: sink.getState(),
        intent: routed.kind,
        timings,
      };
    }

    const profileStartedAt = Date.now();
    const profileSync = await this.syncProfileOnce(
      routed.kind,
      fullMessages,
      lastInput,
      dto.actor,
    );
    timings.ms_profile = Date.now() - profileStartedAt;
    handlerCtx.profileSync = profileSync;

    const legacyStartedAt = Date.now();
    const events = await this.legacyTurnHandler.run(handlerCtx);
    timings.ms_buddy = Date.now() - legacyStartedAt;

    return {
      events,
      assistantReply: sink.getReply(),
      conversationState: sink.getState(),
      intent: routed.kind,
      timings,
    };
  }

  private async syncProfileOnce(
    kind: string,
    messages: ChatMessageDto[],
    input: string,
    actor: ChatRequestDto['actor'],
  ): Promise<UserProfileSyncResult | null> {
    if (kind !== 'create_post') {
      return null;
    }

    return this.userProfileAgent.syncProfileFromChat({
      messages,
      input,
      actor,
    });
  }
}
