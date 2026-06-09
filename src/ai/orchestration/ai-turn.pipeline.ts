import { Injectable, Logger } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import type { BuddySearchHintPayload } from '../intent/chat-intent.types';
import { IntentRouterService } from '../intent/intent-router.service';
import { DeterministicReplyService } from '../orchestration/deterministic-reply.service';
import { PostIntentService } from '../post-intent.service';
import {
  UserProfileAgent,
  type UserProfileSyncResult,
} from '../agents/user-profile.agent';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isExplicitReplacePostIntent } from '../conversation/existing-post-guidance.util';
import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import {
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
  toRecommendedActivityCard,
} from '../utils/activity-enter.util';
import { resolveActivityId } from '../utils/activity-id.util';
import {
  isHomeFestivalShortcutInput,
  resolveHomeFestivalShortcutCode,
} from '../utils/festival-shortcut.util';
import { isTravelGuideIntent } from '../utils/activity-guide.util';
import { shouldSkipActivityScopedBuddyRecommend } from '../buddy/activity-scope-guard.util';
import { BuddyContextService } from '../buddy/buddy-context.service';
import { buildDjInfoSuggestedReplies } from '../dj/dj-info-suggested-replies.util';
import { DjInfoResolverService } from '../dj/dj-info-resolver.service';
import { DjInfoService } from '../dj/dj-info.service';
import { ChatAgentOrchestratorService } from '../agent/chat-agent-orchestrator.service';
import type { ChatAgentTurnResult } from '../agent/agent.types';
import {
  isAwaitingSelfPostBodyCollection,
  isDeclineRecommendationsIntent,
} from '../gate/recommend-gate.util';
import type { ConversationState } from '../conversation';
import { enterCollectPostBodyState } from '../conversation';
import { logAiTurn } from '../utils/log-ai-turn.util';
import { ChatRequestDto } from '../presentation/chat-request.dto';
import { ChatMessageDto } from '../../shared/chat';
import type { AiStreamEvent } from '../../shared/chat';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-sse.builder';

export interface AiTurnTimings {
  ms_intent?: number;
  ms_profile?: number;
  ms_buddy?: number;
  ms_match?: number;
  ms_agent?: number;
}

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
    private readonly buddyContext: BuddyContextService,
    private readonly activityService: ActivityService,
    private readonly djInfoService: DjInfoService,
    private readonly djInfoResolver: DjInfoResolverService,
    private readonly chatAgentOrchestrator: ChatAgentOrchestratorService,
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
    const forceCreatePostIntent =
      conversationState.flow === 'collect_post_body' ||
      isAwaitingSelfPostBodyCollection(fullMessages, conversationState) ||
      isDeclineRecommendationsIntent(lastInput.trim());

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

    this.chatAgentOrchestrator.scheduleShadowComparison({
      dto,
      messages: fullMessages,
      input: lastInput,
      conversationState,
      requestId,
      sessionId,
      legacyIntent: routed,
    });

    if (
      this.chatAgentOrchestrator.getMode() === 'on' &&
      this.chatAgentOrchestrator.shouldRunAgentFirst(
        dto,
        lastInput,
        conversationState,
      )
    ) {
      const agentStartedAt = Date.now();
      const agentResult = await this.chatAgentOrchestrator.runTurn({
        dto,
        messages: fullMessages,
        input: lastInput,
        conversationState,
        requestId,
        sessionId,
        legacyIntent: routed,
      });
      timings.ms_agent = Date.now() - agentStartedAt;

      if (agentResult?.replyText) {
        logAiTurn(this.logger, {
          event: 'agent_turn',
          requestId,
          sessionId,
          intent: routed.kind,
          intentSource: 'agent',
          agentTools: agentResult.toolsUsed,
          ms_agent: timings.ms_agent,
        });

        const events = await this.collectAgentReply(
          agentResult,
          dto,
          fullMessages,
          lastInput,
          sink,
        );
        return {
          events,
          assistantReply: sink.getReply(),
          conversationState: sink.getState(),
          intent: routed.kind,
          timings,
        };
      }
    }

    const profileStartedAt = Date.now();
    const profileSync = await this.syncProfileOnce(
      routed.kind,
      fullMessages,
      lastInput,
      dto.actor,
    );
    timings.ms_profile = Date.now() - profileStartedAt;

    let events: AiStreamEvent[] = [];
    const buddyStartedAt = Date.now();

    switch (routed.kind) {
      case 'search_posts':
        events = await this.collectMatchOnly(
          dto,
          fullMessages,
          lastInput,
          sink,
          routed,
          profileSync,
          timings,
        );
        break;
      case 'create_post':
        events = await this.collectBuddyIntentFlow(
          dto,
          fullMessages,
          lastInput,
          sink,
          profileSync,
          timings,
        );
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
        events = await this.collectDjInfo(dto, fullMessages, lastInput, sink);
        break;
      default:
        events = await this.collectBuddyIntentFlow(
          dto,
          fullMessages,
          lastInput,
          sink,
          profileSync,
          timings,
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
    if (kind !== 'search_posts' && kind !== 'create_post') {
      return null;
    }

    // Activity shortcut chips (找组队/找拼房/找卡座等) only need post search — skip profile LLM.
    if (kind === 'search_posts' && isAiShortcutTag(input)) {
      return null;
    }

    return this.userProfileAgent.syncProfileFromChat({
      messages,
      input,
      actor,
    });
  }

  private async collectMatchOnly(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
    routed: { buddySearchHint?: BuddySearchHintPayload },
    profileSync: UserProfileSyncResult | null,
    timings: AiTurnTimings,
  ): Promise<AiStreamEvent[]> {
    const requireBuddy =
      await this.buddyContext.maybeRequireBuddyPostBeforeTeamSearch(
        lastInput,
        dto.activityLegacyId,
        dto.actor,
      );
    if (requireBuddy.required) {
      return this.sseBuilder.buildRequireBuddyPostFirstEvents(
        sink,
        dto.activityLegacyId,
        requireBuddy.activityLabel,
      );
    }

    const matchStart = Date.now();
    const matched = await this.postIntentService.tryMatchPostsFromChat({
      messages: fullMessages,
      input: lastInput,
      activityLegacyId: dto.activityLegacyId,
      actor: dto.actor,
      buddySearchHint: routed.buddySearchHint,
      fromIntentRouter: true,
      profileSync,
    });
    timings.ms_match = Date.now() - matchStart;

    if (matched) {
      const activityLabel = matched.activityLabel ?? '本活动';
      const useRecommendGate =
        isAiShortcutTag(lastInput) && dto.activityLegacyId != null;

      if (useRecommendGate && matched.postCards.length) {
        return this.sseBuilder.buildRecommendGateFoundEvents(
          sink,
          dto.activityLegacyId,
          activityLabel,
          matched.postCards,
          matched.postCards.length,
          matched.degraded,
        );
      }

      if (useRecommendGate && !matched.postCards.length) {
        return this.sseBuilder.buildRecommendGateEmptyEvents(
          sink,
          dto.activityLegacyId,
          activityLabel,
        );
      }

      sink.setReply(matched.replyText);
      const events: AiStreamEvent[] = [
        { type: 'delta', content: matched.replyText },
      ];
      if (matched.postCards.length) {
        events.push({
          type: 'post_recommendations',
          posts: matched.postCards,
          degraded: matched.degraded,
        });
      } else if (dto.activityLegacyId != null) {
        sink.setState(
          enterCollectPostBodyState({
            activityLegacyId: dto.activityLegacyId,
            fromSelfPost: true,
          }),
        );
        events.push(this.sseBuilder.conversationPatchEvent(sink));
      }
      return events;
    }

    return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
  }

  private async collectBuddyIntentFlow(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
    profileSync: UserProfileSyncResult | null,
    timings: AiTurnTimings,
  ): Promise<AiStreamEvent[]> {
    const effectiveActivityLegacyId =
      await this.resolveEffectiveActivityLegacyId(dto, fullMessages, lastInput);

    if (
      this.shouldSkipRecommendBeforeCreate(
        fullMessages,
        lastInput,
        effectiveActivityLegacyId,
        sink.getState(),
      )
    ) {
      const postEvents = await this.applyPostAttempt(
        dto,
        fullMessages,
        lastInput,
        sink,
        effectiveActivityLegacyId,
      );
      if (postEvents.length > 0) return postEvents;
      return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
    }

    const requireBuddy =
      await this.buddyContext.maybeRequireBuddyPostBeforeTeamSearch(
        lastInput,
        effectiveActivityLegacyId,
        dto.actor,
      );
    if (requireBuddy.required) {
      return this.sseBuilder.buildRequireBuddyPostFirstEvents(
        sink,
        effectiveActivityLegacyId,
        requireBuddy.activityLabel,
      );
    }

    const matchStart = Date.now();
    const recommended =
      await this.postIntentService.tryProactiveRecommendBeforeCreate({
        messages: fullMessages,
        input: lastInput,
        activityLegacyId: effectiveActivityLegacyId,
        actor: dto.actor,
        conversationState: sink.getState(),
        profileSync,
      });
    timings.ms_match = Date.now() - matchStart;

    if (recommended?.postCards.length) {
      const activityLabel =
        recommended.postCards[0]?.eventTitle ??
        recommended.activityLabel ??
        '本活动';
      return this.sseBuilder.buildRecommendGateFoundEvents(
        sink,
        effectiveActivityLegacyId,
        activityLabel,
        recommended.postCards,
        recommended.postCards.length,
        recommended.degraded,
      );
    }

    if (recommended && recommended.postCards.length === 0) {
      const activityLabel = recommended.activityLabel ?? '本活动';
      return this.sseBuilder.buildRecommendGateEmptyEvents(
        sink,
        effectiveActivityLegacyId,
        activityLabel,
      );
    }

    const postEvents = await this.applyPostAttempt(
      dto,
      fullMessages,
      lastInput,
      sink,
      effectiveActivityLegacyId,
    );
    if (postEvents.length > 0) return postEvents;

    return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
  }

  private async resolveEffectiveActivityLegacyId(
    dto: ChatRequestDto,
    messages: ChatMessageDto[],
    input: string,
  ): Promise<number | undefined> {
    if (dto.activityLegacyId != null && !Number.isNaN(dto.activityLegacyId)) {
      return dto.activityLegacyId;
    }
    if (isHomeFestivalShortcutInput(input.trim())) {
      return undefined;
    }
    return this.buddyContext.resolveActivityLegacyIdFromChat(messages, input);
  }

  private shouldSkipRecommendBeforeCreate(
    messages: ChatMessageDto[],
    lastInput: string,
    effectiveActivityLegacyId: number | undefined,
    state: ConversationState,
  ): boolean {
    const trimmed = lastInput.trim();
    if (effectiveActivityLegacyId == null) return true;
    if (isTravelGuideIntent(trimmed)) return true;
    if (
      shouldSkipActivityScopedBuddyRecommend(trimmed, effectiveActivityLegacyId)
    ) {
      return true;
    }
    if (isPublishConfirmIntent(trimmed)) return true;
    if (isExplicitReplacePostIntent(trimmed)) return true;
    if (isDeclineRecommendationsIntent(trimmed)) return true;
    if (
      state.flow === 'collect_post_body' ||
      state.flow === 'publish_confirm'
    ) {
      return true;
    }
    if (isAwaitingSelfPostBodyCollection(messages, state)) {
      return true;
    }
    return false;
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

    return this.activityService.matchActivity(input);
  }

  private async collectAgentReply(
    agentResult: ChatAgentTurnResult,
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const replyText = agentResult.replyText;
    sink.setReply(replyText);
    const events: AiStreamEvent[] = [{ type: 'delta', content: replyText }];

    if (agentResult.toolsUsed.includes('query_dj_info')) {
      const toolCall = agentResult.toolCalls.find(
        (call) => call.name === 'query_dj_info',
      );
      const query = await this.djInfoResolver.resolve({
        messages: fullMessages,
        input: lastInput,
        activityLegacyId: dto.activityLegacyId,
        toolArgs: toolCall?.args,
      });
      const suggested = this.sseBuilder.djInfoSuggestedRepliesEvent(
        buildDjInfoSuggestedReplies({
          query,
          activityLegacyId: dto.activityLegacyId,
        }),
      );
      if (suggested) {
        events.push(suggested);
      }
    }

    return events;
  }

  private async collectDjInfo(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const { replyText, suggestedReplies } =
      await this.djInfoService.answerFromChat(lastInput, dto.activityLegacyId, {
        messages: fullMessages,
      });
    sink.setReply(replyText);
    const events: AiStreamEvent[] = [{ type: 'delta', content: replyText }];
    const suggested =
      this.sseBuilder.djInfoSuggestedRepliesEvent(suggestedReplies);
    if (suggested) {
      events.push(suggested);
    }
    return events;
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

  private async applyPostAttempt(
    dto: ChatRequestDto,
    fullMessages: ChatMessageDto[],
    lastInput: string,
    sink: ReplySink,
    effectiveActivityLegacyId?: number,
  ): Promise<AiStreamEvent[]> {
    const postAttempt = await this.postIntentService.tryCreatePostFromChat({
      messages: fullMessages,
      input: lastInput,
      actor: dto.actor,
      activityLegacyId: effectiveActivityLegacyId ?? dto.activityLegacyId,
      image: dto.image,
      images: dto.images,
      conversationState: sink.getState(),
      onStateChange: (state) => sink.setState(state),
    });

    return this.sseBuilder.eventsFromPostAttempt(postAttempt, sink);
  }
}
