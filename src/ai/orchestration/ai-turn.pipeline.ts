import { Injectable, Logger } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { IntentRouterService } from '../intent/intent-router.service';
import { DeterministicReplyService } from '../orchestration/deterministic-reply.service';
import { PostIntentService } from '../post-intent.service';
import {
  UserProfileAgent,
  type UserProfileSyncResult,
} from '../agents/user-profile.agent';
import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { mustForceCreatePostIntent } from '../policy/chat-turn-policy';
import { PostingTurnOrchestrator } from './posting-turn.orchestrator';
import { AgentFirstTurnHandler } from './handlers/agent-first-turn.handler';
import { DjInfoTurnHandler } from './handlers/dj-info-turn.handler';
import type {
  AiTurnTimings,
  TurnHandlerContext,
} from './handlers/turn-handler.types';
import {
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
  toRecommendedActivityCard,
} from '../utils/activity-enter.util';
import { resolveActivityId } from '../utils/activity-id.util';
import { resolveHomeFestivalShortcutCode } from '../utils/festival-shortcut.util';
import { logAiTurn } from '../utils/log-ai-turn.util';
import { ChatRequestDto } from '../presentation/chat-request.dto';
import { ChatMessageDto } from '../../shared/chat';
import type { AiStreamEvent } from '../../shared/chat';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-stream-event.builder';
import type { ConversationState } from '../conversation';

export type { AiTurnTimings } from './handlers/turn-handler.types';

export interface AiTurnResult {
  events: AiStreamEvent[];
  assistantReply: string;
  conversationState: ConversationState;
  intent?: string;
  timings: AiTurnTimings;
  earlyComplete?: boolean;
}

@Injectable()
export class AiTurnPipeline {
  private readonly logger = new Logger(AiTurnPipeline.name);

  constructor(
    private readonly agenticReplyService: DeterministicReplyService,
    private readonly postIntentService: PostIntentService,
    private readonly userProfileAgent: UserProfileAgent,
    private readonly intentRouter: IntentRouterService,
    private readonly sseBuilder: AiStreamEventBuilder,
    private readonly activityService: ActivityService,
    private readonly agentFirstTurnHandler: AgentFirstTurnHandler,
    private readonly djInfoTurnHandler: DjInfoTurnHandler,
    private readonly postingTurnOrchestrator: PostingTurnOrchestrator,
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

    const agentFirst = await this.agentFirstTurnHandler.tryRun(handlerCtx);
    if (agentFirst) {
      if (agentFirst.timingsPatch?.ms_agent != null) {
        timings.ms_agent = agentFirst.timingsPatch.ms_agent;
      }
      return {
        events: agentFirst.events,
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

    let events: AiStreamEvent[] = [];
    const buddyStartedAt = Date.now();

    switch (routed.kind) {
      case 'create_post':
        events = await this.postingTurnOrchestrator.run({
          dto,
          messages: fullMessages,
          input: lastInput,
          sink,
          profileSync,
          timings,
        });
        break;
      case 'quick_reply':
        events = await this.collectDeterministicOnly(
          dto,
          fullMessages,
          lastInput,
          sink,
        );
        break;
      case 'activity_enter':
        events = await this.collectActivityEnter(fullMessages, lastInput, sink);
        if (events.length === 0) {
          events = await this.collectDeterministicOnly(
            dto,
            fullMessages,
            lastInput,
            sink,
          );
        }
        break;
      case 'dj_info':
        events = await this.djInfoTurnHandler.run(handlerCtx);
        break;
      default:
        events = await this.collectDeterministicOnly(
          dto,
          fullMessages,
          lastInput,
          sink,
        );
        break;
    }

    timings.ms_buddy = Date.now() - buddyStartedAt;

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

    if (isAiShortcutTag(input)) {
      return null;
    }

    return this.userProfileAgent.syncProfileFromChat({
      messages,
      input,
      actor,
    });
  }

  private async collectActivityEnter(
    messages: ChatMessageDto[],
    input: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    if (
      !isAwaitingActivityEnterSelection(messages) ||
      !isActivityEnterNameInput(input)
    ) {
      return [];
    }

    const activity = await this.resolveActivityForEnter(input.trim());
    if (!activity?.legacyId) {
      return [];
    }

    const card = toRecommendedActivityCard(activity);
    return this.sseBuilder.buildActivityEnterEvents(sink, card);
  }

  private async resolveActivityForEnter(input: string) {
    const festivalCode = resolveHomeFestivalShortcutCode(input);
    if (festivalCode) {
      return this.activityService.findByCode(festivalCode).exec();
    }

    const activityCode = resolveActivityId(input);
    if (activityCode) {
      return this.activityService.findByCode(activityCode).exec();
    }

    return this.activityService.resolveActivityByKeyword(input);
  }

  private async collectDeterministicOnly(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const reply = await this.agenticReplyService.resolve(
      fullMessages,
      lastInput,
      {
        actor: dto.actor,
        userPhone: dto.userPhone,
        image: dto.image,
        activityLegacyId: dto.activityLegacyId,
      },
      sink.getState(),
    );

    sink.setReply(reply.text);
    sink.setState(reply.nextState);

    const events: AiStreamEvent[] = [];
    if (reply.text) {
      events.push({ type: 'delta', content: reply.text });
    }
    if (reply.nextState.flow !== 'idle') {
      events.push(this.sseBuilder.conversationPatchEvent(sink));
    }
    return events;
  }
}
