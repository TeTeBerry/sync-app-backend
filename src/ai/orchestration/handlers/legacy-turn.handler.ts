import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { isDjInfoIntent } from '../../dj/dj-info-query.util';
import { DeterministicReplyService } from '../deterministic-reply.service';
import { PostingTurnOrchestrator } from '../posting-turn.orchestrator';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../../presentation/ai-stream-event.builder';
import {
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
  toRecommendedActivityCard,
} from '../../utils/activity-enter.util';
import { resolveActivityId } from '../../utils/activity-id.util';
import { resolveHomeFestivalShortcutCode } from '../../utils/festival-shortcut.util';
import type { AiStreamEvent } from '../../../shared/chat';
import type { TurnHandlerContext } from './turn-handler.types';
import { DjInfoTurnHandler } from './dj-info-turn.handler';

/**
 * Agent-off or agent-miss fallback: posting, activity enter, DJ, quick-reply templates.
 * Write flows (travel guide, itinerary, etc.) are agent-tool only — no duplicate CTAs here.
 */
@Injectable()
export class LegacyTurnHandler {
  constructor(
    private readonly postingTurnOrchestrator: PostingTurnOrchestrator,
    private readonly djInfoTurnHandler: DjInfoTurnHandler,
    private readonly agenticReplyService: DeterministicReplyService,
    private readonly sseBuilder: AiStreamEventBuilder,
    private readonly activityService: ActivityService,
  ) {}

  async run(ctx: TurnHandlerContext): Promise<AiStreamEvent[]> {
    const { routed } = ctx;

    if (routed.kind === 'create_post') {
      return this.postingTurnOrchestrator.run({
        dto: ctx.dto,
        messages: ctx.messages,
        input: ctx.input,
        sink: ctx.sink,
        profileSync: ctx.profileSync,
        timings: ctx.timings,
      });
    }

    if (routed.kind === 'activity_enter') {
      const enterEvents = await this.collectActivityEnter(
        ctx.messages,
        ctx.input,
        ctx.sink,
      );
      if (enterEvents.length > 0) {
        return enterEvents;
      }
    }

    if (isDjInfoIntent(ctx.input.trim())) {
      return this.djInfoTurnHandler.run(ctx);
    }

    return this.collectDeterministicReply(ctx);
  }

  private async collectActivityEnter(
    messages: TurnHandlerContext['messages'],
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

  private async collectDeterministicReply(
    ctx: TurnHandlerContext,
  ): Promise<AiStreamEvent[]> {
    const reply = await this.agenticReplyService.resolve(
      ctx.messages,
      ctx.input,
      {
        actor: ctx.dto.actor,
        userPhone: ctx.dto.userPhone,
        image: ctx.dto.image,
        activityLegacyId: ctx.dto.activityLegacyId,
      },
      ctx.sink.getState(),
    );

    ctx.sink.setReply(reply.text);
    ctx.sink.setState(reply.nextState);

    const events: AiStreamEvent[] = [];
    if (reply.text) {
      events.push({ type: 'delta', content: reply.text });
    }
    if (reply.nextState.flow !== 'idle') {
      events.push(this.sseBuilder.conversationPatchEvent(ctx.sink));
    }
    return events;
  }
}
