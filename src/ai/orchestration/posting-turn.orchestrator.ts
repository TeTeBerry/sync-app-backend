import { Injectable } from '@nestjs/common';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import { shouldSkipProactiveRecommend } from '../policy/chat-turn-policy';
import { BuddyContextService } from '../buddy/buddy-context.service';
import { PostIntentService } from '../post-intent.service';
import { DeterministicReplyService } from './deterministic-reply.service';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-sse.builder';
import type { UserProfileSyncResult } from '../agents/user-profile.agent';
import type { ChatRequestDto } from '../presentation/chat-request.dto';
import type { ChatMessageDto, AiStreamEvent } from '../../shared/chat';
import type { AiTurnTimings } from './handlers/turn-handler.types';

export interface PostingTurnParams {
  dto: ChatRequestDto;
  messages: ChatMessageDto[];
  input: string;
  sink: ReplySink;
  profileSync: UserProfileSyncResult | null;
  timings: AiTurnTimings;
}

@Injectable()
export class PostingTurnOrchestrator {
  constructor(
    private readonly postIntentService: PostIntentService,
    private readonly buddyContext: BuddyContextService,
    private readonly sseBuilder: AiStreamEventBuilder,
    private readonly agenticReplyService: DeterministicReplyService,
  ) {}

  async run(params: PostingTurnParams): Promise<AiStreamEvent[]> {
    const { dto, messages, input, sink, profileSync, timings } = params;
    const effectiveActivityLegacyId =
      await this.resolveEffectiveActivityLegacyId(dto, messages, input);

    if (
      shouldSkipProactiveRecommend({
        messages,
        input,
        effectiveActivityLegacyId,
        state: sink.getState(),
      })
    ) {
      const postEvents = await this.applyPostAttempt(
        dto,
        messages,
        input,
        sink,
        effectiveActivityLegacyId,
      );
      if (postEvents.length > 0) {
        return postEvents;
      }
      return this.collectDeterministicFallback(dto, messages, input, sink);
    }

    const requireBuddy =
      await this.buddyContext.maybeRequireBuddyPostBeforeTeamSearch(
        input,
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
        messages,
        input,
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
      messages,
      input,
      sink,
      effectiveActivityLegacyId,
    );
    if (postEvents.length > 0) {
      return postEvents;
    }

    return this.collectDeterministicFallback(dto, messages, input, sink);
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

  private async applyPostAttempt(
    dto: ChatRequestDto,
    messages: ChatMessageDto[],
    input: string,
    sink: ReplySink,
    effectiveActivityLegacyId?: number,
  ): Promise<AiStreamEvent[]> {
    const postAttempt = await this.postIntentService.tryCreatePostFromChat({
      messages,
      input,
      actor: dto.actor,
      activityLegacyId: effectiveActivityLegacyId ?? dto.activityLegacyId,
      image: dto.image,
      images: dto.images,
      conversationState: sink.getState(),
      onStateChange: (state) => sink.setState(state),
    });

    return this.sseBuilder.eventsFromPostAttempt(postAttempt, sink);
  }

  private async collectDeterministicFallback(
    dto: ChatRequestDto,
    messages: ChatMessageDto[],
    input: string,
    sink: ReplySink,
  ): Promise<AiStreamEvent[]> {
    const reply = await this.agenticReplyService.resolve(
      messages,
      input,
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
