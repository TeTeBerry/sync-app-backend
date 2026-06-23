import { Inject, Injectable, Logger } from '@nestjs/common';
import { DjInfoService } from '../../dj/dj-info.service';
import { buildItineraryScheduleOverviewReply } from '../../agent/itinerary-schedule-reply.util';
import {
  IItineraryPort,
  ITINERARY_PORT,
} from '../../../modules/itinerary/ports/itinerary-agent.port';
import { ActivityService } from '../../../modules/activity/activity.service';
import { buildDjInfoSuggestedReplies } from '../../dj/dj-info-suggested-replies.util';
import { buildItineraryCollectPrompt } from '../../agent/itinerary-chat-slots.util';
import { buildNearEventsReply } from '../../utils/activity-reply.util';
import { toRecommendedActivityCard } from '../../utils/activity-enter.util';
import { resolveHomeFestivalShortcutCode } from '../../utils/festival-shortcut.util';
import { enterItineraryCollectState } from '../../conversation';
import { logAiTurn } from '../../utils/log-ai-turn.util';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../../presentation/ai-stream-event.builder';
import type { AiStreamEvent } from '@sync/chat-contracts';
import type { AgentTurnResult, TurnHandlerContext } from './turn-handler.types';

const TRAVEL_GUIDE_SHEET_REPLY =
  '好的，请填写出发地、人数和预算，我来帮你生成出行攻略～';

@Injectable()
export class ReadOnlyTurnHandler {
  private readonly logger = new Logger(ReadOnlyTurnHandler.name);

  constructor(
    private readonly djInfoService: DjInfoService,
    @Inject(ITINERARY_PORT) private readonly itinerary: IItineraryPort,
    private readonly activityService: ActivityService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async tryRun(ctx: TurnHandlerContext): Promise<AgentTurnResult | null> {
    const path = ctx.routed.readOnlyFastPath;
    if (!path) {
      return null;
    }

    const startedAt = Date.now();
    const events = await this.runFastPath(ctx, path);
    if (!events.length) {
      return null;
    }

    logAiTurn(this.logger, {
      event: 'read_only_fast_path',
      requestId: ctx.requestId,
      sessionId: ctx.sessionId,
      intent: ctx.routed.kind,
      readOnlyFastPath: path,
      ms_read_only: Date.now() - startedAt,
    });

    return {
      events,
      timingsPatch: { ms_read_only: Date.now() - startedAt },
    };
  }

  private async runFastPath(
    ctx: TurnHandlerContext,
    path: NonNullable<TurnHandlerContext['routed']['readOnlyFastPath']>,
  ): Promise<AiStreamEvent[]> {
    switch (path) {
      case 'lineup':
        return this.runLineup(ctx);
      case 'schedule':
        return this.runSchedule(ctx);
      case 'travel_guide_sheet':
        return this.runTravelGuideSheet(ctx.sink);
      case 'itinerary_sheet':
        return this.runItinerarySheet(ctx);
      case 'near_events':
        return this.runNearEvents(ctx);
      case 'festival_catalog':
        return this.runFestivalCatalog(ctx);
      default:
        return [];
    }
  }

  private async runFestivalCatalog(
    ctx: TurnHandlerContext,
  ): Promise<AiStreamEvent[]> {
    const code = resolveHomeFestivalShortcutCode(ctx.input.trim());
    if (!code) {
      return [];
    }

    const activity = await this.activityService.findByCode(code);
    if (!activity?.legacyId) {
      return [];
    }

    const card = toRecommendedActivityCard(activity);
    return this.sseBuilder.buildActivityEnterEvents(ctx.sink, card);
  }

  private async runNearEvents(
    ctx: TurnHandlerContext,
  ): Promise<AiStreamEvent[]> {
    const activities = await this.activityService.findAll();
    const replyText = buildNearEventsReply(activities);
    ctx.sink.setReply(replyText);
    return [{ type: 'delta', content: replyText }];
  }

  private async runLineup(ctx: TurnHandlerContext): Promise<AiStreamEvent[]> {
    const activityLegacyId = ctx.dto.activityLegacyId;
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      return [];
    }

    const query = {
      intent: 'lineup_overview' as const,
      styles: [] as string[],
      scope: 'lineup' as const,
    };
    const { replyText } = await this.djInfoService.answerFromStructured(
      query,
      activityLegacyId,
    );
    ctx.sink.setReply(replyText);

    const events: AiStreamEvent[] = [{ type: 'delta', content: replyText }];
    const suggested = this.sseBuilder.djInfoSuggestedRepliesEvent(
      buildDjInfoSuggestedReplies({ query, activityLegacyId }),
    );
    if (suggested) {
      events.push(suggested);
    }
    return events;
  }

  private async runSchedule(ctx: TurnHandlerContext): Promise<AiStreamEvent[]> {
    const activityLegacyId = ctx.dto.activityLegacyId;
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      return [];
    }

    const schedule = await this.itinerary.getSchedule(activityLegacyId, {});
    const replyText = buildItineraryScheduleOverviewReply(schedule);
    ctx.sink.setReply(replyText);

    return [{ type: 'delta', content: replyText }];
  }

  private runTravelGuideSheet(sink: ReplySink): AiStreamEvent[] {
    sink.setReply(TRAVEL_GUIDE_SHEET_REPLY);
    return [
      { type: 'delta', content: TRAVEL_GUIDE_SHEET_REPLY },
      this.sseBuilder.openSheetPromptAction('travel_guide'),
    ];
  }

  private runItinerarySheet(ctx: TurnHandlerContext): AiStreamEvent[] {
    const legacyId = ctx.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return [];
    }

    const reply = buildItineraryCollectPrompt();
    ctx.sink.setReply(reply);
    ctx.sink.setState(enterItineraryCollectState({}));

    return [
      { type: 'delta', content: reply },
      this.sseBuilder.openSheetPromptAction('itinerary'),
      this.sseBuilder.conversationPatchEvent(ctx.sink),
    ];
  }
}
