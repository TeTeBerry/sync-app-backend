import { Injectable, Logger } from '@nestjs/common';
import type { BuddySearchHintPayload } from '../intent/chat-intent.types';
import { IntentRouterService } from '../intent/intent-router.service';
import { DeterministicReplyService } from '../orchestration/deterministic-reply.service';
import { PostIntentService } from '../post-intent.service';
import {
  UserProfileAgent,
  type UserProfileSyncResult,
} from '../agents/user-profile.agent';
import { detectBuddyCopyStyleRequest } from '../conversation/buddy-copy.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isExplicitReplacePostIntent } from '../conversation/existing-post-guidance.util';
import {
  isAwaitingRecommendationsGate,
  isDeclineRecommendationsIntent,
} from '../gate/recommend-gate.util';
import type { ConversationState } from '../conversation';
import { logAiTurn } from '../utils/log-ai-turn.util';
import { ChatRequestDto } from '../presentation/chat-request.dto';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { AiStreamEvent } from '../presentation/ai-stream-event.view';
import { AiSseBuilder, type ReplySink } from '../presentation/ai-sse.builder';

export interface AiTurnTimings {
  ms_intent?: number;
  ms_profile?: number;
  ms_buddy?: number;
  ms_match?: number;
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
    private readonly sseBuilder: AiSseBuilder,
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
      setReply: text => {
        assistantReply = text;
      },
      getReply: () => assistantReply,
      setState: state => {
        conversationState = state;
      },
      getState: () => conversationState,
    };

    const timings: AiTurnTimings = {};

    const copyStyleRequest = detectBuddyCopyStyleRequest(lastInput);
    if (copyStyleRequest) {
      const copyResult = await this.postIntentService.tryGenerateBuddyCopy({
        messages: fullMessages,
        input: lastInput,
        activityLegacyId: dto.activityLegacyId,
      });

      if (copyResult) {
        sink.setReply(copyResult.replyText);
        const events = this.sseBuilder.withMessageComplete(
          [
            { type: 'delta', content: copyResult.replyText },
            ...(copyResult.variants.length
              ? [
                  {
                    type: 'buddy_copy_variants' as const,
                    variants: copyResult.variants,
                  },
                ]
              : []),
          ],
          copyResult.replyText,
        );

        return {
          events,
          assistantReply: copyResult.replyText,
          conversationState,
          timings,
          earlyComplete: true,
        };
      }
    }

    const intentStartedAt = Date.now();
    const routed = await this.intentRouter.resolve({
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

    const profileStartedAt = Date.now();
    const profileSync = await this.syncProfileOnce(
      routed.kind,
      fullMessages,
      lastInput,
      dto.userId,
      dto.userName,
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
      case 'legacy_cascade':
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
    userId?: string,
    authorName?: string,
  ): Promise<UserProfileSyncResult | null> {
    if (
      kind !== 'search_posts' &&
      kind !== 'create_post' &&
      kind !== 'legacy_cascade'
    ) {
      return null;
    }

    return this.userProfileAgent.syncProfileFromChat({
      messages,
      input,
      userId,
      authorName,
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
    const matchStart = Date.now();
    const matched = await this.postIntentService.tryMatchPostsFromChat({
      messages: fullMessages,
      input: lastInput,
      activityLegacyId: dto.activityLegacyId,
      userId: dto.userId,
      buddySearchHint: routed.buddySearchHint,
      fromIntentRouter: true,
      profileSync,
    });
    timings.ms_match = Date.now() - matchStart;

    if (matched) {
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
    if (
      this.shouldSkipRecommendBeforeCreate(
        fullMessages,
        lastInput,
        dto,
        sink.getState(),
      )
    ) {
      const postEvents = await this.applyPostAttempt(
        dto,
        fullMessages,
        lastInput,
        sink,
      );
      if (postEvents.length > 0) return postEvents;
      return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
    }

    const matchStart = Date.now();
    const recommended =
      await this.postIntentService.tryProactiveRecommendBeforeCreate({
        messages: fullMessages,
        input: lastInput,
        activityLegacyId: dto.activityLegacyId,
        userId: dto.userId,
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
        dto.activityLegacyId,
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
        dto.activityLegacyId,
        activityLabel,
      );
    }

    const postEvents = await this.applyPostAttempt(
      dto,
      fullMessages,
      lastInput,
      sink,
    );
    if (postEvents.length > 0) return postEvents;

    return this.collectDeterministicOnly(dto, fullMessages, lastInput, sink);
  }

  private shouldSkipRecommendBeforeCreate(
    messages: ChatMessageDto[],
    lastInput: string,
    dto: ChatRequestDto,
    state: ConversationState,
  ): boolean {
    const trimmed = lastInput.trim();
    if (!dto.activityLegacyId) return true;
    if (isPublishConfirmIntent(trimmed)) return true;
    if (isExplicitReplacePostIntent(trimmed)) return true;
    if (isDeclineRecommendationsIntent(trimmed)) return true;
    if (isAwaitingRecommendationsGate(messages, state)) return true;
    return false;
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
        userId: dto.userId,
        userName: dto.userName,
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
  ): Promise<AiStreamEvent[]> {
    const postAttempt = await this.postIntentService.tryCreatePostFromChat({
      messages: fullMessages,
      input: lastInput,
      userId: dto.userId,
      userName: dto.userName,
      activityLegacyId: dto.activityLegacyId,
      image: dto.image,
      conversationState: sink.getState(),
      onStateChange: state => sink.setState(state),
    });

    return this.sseBuilder.eventsFromPostAttempt(postAttempt, sink);
  }
}
