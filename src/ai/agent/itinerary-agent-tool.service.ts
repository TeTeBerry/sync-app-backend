import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ItineraryService } from '../../modules/itinerary/itinerary.service';
import { PersonalityTestService } from '../../modules/personality-test/personality-test.service';
import {
  clearActiveTask,
  enterItineraryCollectState,
  mergeItineraryActiveTask,
} from '../conversation';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-stream-event.builder';
import type { ChatAgentRuntime, ChatAgentTurnInput } from './agent.types';
import type { ChatAgentToolExecutionResult } from './tools/chat-agent-tool.types';
import {
  buildItineraryCollectPrompt,
  parseDjNamesFromUserText,
  resolveDjIdsFromNames,
} from './itinerary-chat-slots.util';

function asSink(runtime: ChatAgentRuntime): ReplySink {
  return {
    setReply: (text) => runtime.setReply(text),
    getReply: () => runtime.getReply(),
    setState: (state) => runtime.setState(state),
    getState: () => runtime.getState(),
  };
}

@Injectable()
export class ItineraryAgentToolService {
  private readonly logger = new Logger(ItineraryAgentToolService.name);

  constructor(
    private readonly itineraryService: ItineraryService,
    private readonly personalityTest: PersonalityTestService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async getSchedule(
    input: ChatAgentTurnInput,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动后再查看演出日程。',
        error: 'activity_not_bound',
      };
    }

    const schedule = await this.itineraryService.getSchedule(legacyId, {});
    const djPreview = schedule.djs
      .slice(0, 12)
      .map((dj) => dj.name)
      .join('、');

    const lines = [schedule.eventMeta];
    if (schedule.djs.length === 0) {
      lines.push('阵容未公布，官宣后会第一时间同步～');
    } else if (schedule.schedulePublished) {
      lines.push(
        `官方演出表已发布，共 ${schedule.performances.length} 场演出。`,
      );
      lines.push(`部分艺人：${djPreview}`);
    } else {
      lines.push('阵容已公布，官方演出时段尚未发布。');
      lines.push(`部分艺人：${djPreview}`);
    }

    return {
      ok: true,
      content: lines.join('\n'),
      data: {
        schedulePublished: schedule.schedulePublished,
        djCount: schedule.djs.length,
      },
    };
  }

  async openSheet(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动后再生成专属行程。',
        error: 'activity_not_bound',
      };
    }

    const reply = buildItineraryCollectPrompt();
    const sink = asSink(runtime);
    sink.setReply(reply);
    sink.setState(enterItineraryCollectState({}));

    return {
      ok: true,
      content: 'opened_itinerary_sheet',
      terminal: true,
      replyOverride: reply,
      streamEvents: [
        { type: 'delta', content: reply },
        this.sseBuilder.openSheetPromptAction('itinerary'),
        this.sseBuilder.conversationPatchEvent(sink),
      ],
    };
  }

  async collectAndGenerate(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    userText?: string,
    selectedDjIds?: string[],
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动后再生成专属行程。',
        error: 'activity_not_bound',
      };
    }

    const sink = asSink(runtime);
    const schedule = await this.itineraryService.getSchedule(legacyId, {});

    let djIds = [...(selectedDjIds ?? [])].filter(Boolean);
    if (!djIds.length) {
      const activeTask = sink.getState().activeTask;
      const prev =
        activeTask?.kind === 'itinerary'
          ? activeTask.itinerary.selectedDjIds
          : undefined;
      djIds = [...(prev ?? [])];
    }

    if (!djIds.length) {
      const names = parseDjNamesFromUserText(userText ?? input.input);
      djIds = resolveDjIdsFromNames(
        names,
        schedule.djs.map((dj) => ({ id: dj.id, name: dj.name })),
      );
    }

    if (!djIds.length) {
      djIds = await this.resolveDjIdsFromPersonality(
        input,
        legacyId,
        schedule.djs.map((dj) => ({ id: dj.id, name: dj.name })),
      );
    }

    if (!djIds.length) {
      const reply = buildItineraryCollectPrompt();
      sink.setReply(reply);
      sink.setState(enterItineraryCollectState({}));
      return {
        ok: true,
        content: JSON.stringify({ missing: 'selectedDjIds' }),
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          this.sseBuilder.openSheetPromptAction('itinerary'),
          this.sseBuilder.conversationPatchEvent(sink),
        ],
      };
    }

    sink.setState(
      mergeItineraryActiveTask(sink.getState(), { selectedDjIds: djIds }),
    );
    return this.generate(input, runtime, djIds);
  }

  async generate(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    selectedDjIds: string[],
    dateKey?: string,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动后再生成专属行程。',
        error: 'activity_not_bound',
      };
    }

    const ids = [
      ...new Set(selectedDjIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!ids.length) {
      return this.openSheet(input, runtime);
    }

    const sink = asSink(runtime);
    try {
      const result = await this.itineraryService.generate(
        legacyId,
        { selectedDjIds: ids, dateKey },
        input.dto.actor,
      );

      const itineraryId = input.requestId || randomUUID();
      const dayCount = result.itinerary.days.length;
      const conflictNote =
        result.conflicts.length > 0
          ? `（有 ${result.conflicts.length} 处时间冲突，可在详情页调整）`
          : '';
      const reply = `已生成 ${dayCount} 天专属演出行程${conflictNote}，点击查看～`;

      sink.setReply(reply);
      sink.setState(clearActiveTask(sink.getState()));

      return {
        ok: true,
        content: 'itinerary_generated',
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          {
            type: 'itinerary_ready',
            itineraryId,
            activityLegacyId: legacyId,
            selectedDjIds: ids,
            eventMeta: result.itinerary.eventMeta,
            days: result.itinerary.days,
            conflicts: result.conflicts,
            cached: result.cached,
          },
          this.sseBuilder.conversationPatchEvent(sink),
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '行程生成失败，请稍后重试';
      this.logger.warn(`itinerary generate failed: ${message}`);
      return {
        ok: false,
        content: message,
        error: 'generation_failed',
        terminal: true,
        replyOverride: message,
        streamEvents: [{ type: 'delta', content: message }],
      };
    }
  }

  private async resolveDjIdsFromPersonality(
    input: ChatAgentTurnInput,
    activityLegacyId: number,
    lineup: Array<{ id: string; name: string }>,
  ): Promise<string[]> {
    const userId = input.dto.actor.resolvedUserId?.trim();
    if (!userId) return [];

    const saved = await this.personalityTest.getSavedResult(userId);
    if (!saved) return [];

    const event = saved.recommendedEvents.find(
      (item) => item.activityLegacyId === activityLegacyId,
    );
    const names = event?.matchedDjs?.length
      ? event.matchedDjs
      : [
          saved.recommendations.soulMatch.djName,
          ...saved.recommendations.mustSee.map((dj) => dj.djName),
        ];

    return resolveDjIdsFromNames(names, lineup);
  }
}
