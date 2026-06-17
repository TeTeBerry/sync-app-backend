import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ActivityService } from '../../modules/activity/activity.service';
import { TravelGuideGenerationService } from '../../modules/travel-guide/travel-guide-generation.service';
import { parseActivityDayCount } from '../../modules/travel-guide/domain/parse-activity-days.util';
import {
  clearActiveTask,
  enterTravelGuideCollectState,
  mergeTravelGuideActiveTask,
} from '../conversation';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-stream-event.builder';
import type { TravelGuideChatForm } from '../../shared/chat';
import type { ChatAgentRuntime, ChatAgentTurnInput } from './agent.types';
import type { ChatAgentToolExecutionResult } from './tools/chat-agent-tool.types';
import {
  buildTravelGuideCollectPrompt,
  isTravelGuideChatInterrupt,
  listMissingTravelGuideSlots,
  mergeTravelGuideDraft,
  parseTravelGuideChatMessage,
  travelGuideDraftToForm,
  type TravelGuideChatDraft,
} from './travel-guide-chat-slots.util';

function asSink(runtime: ChatAgentRuntime): ReplySink {
  return {
    setReply: (text) => runtime.setReply(text),
    getReply: () => runtime.getReply(),
    setState: (state) => runtime.setState(state),
    getState: () => runtime.getState(),
  };
}

@Injectable()
export class TravelGuideAgentToolService {
  private readonly logger = new Logger(TravelGuideAgentToolService.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly generationService: TravelGuideGenerationService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async collectSlots(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    userText?: string,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动后再生成出行攻略。',
        error: 'activity_not_bound',
      };
    }

    const raw = (userText ?? input.input).trim();
    if (!raw) {
      return {
        ok: false,
        content: '缺少用户消息，无法解析攻略参数。',
        error: 'empty_input',
      };
    }

    if (isTravelGuideChatInterrupt(raw)) {
      const sink = asSink(runtime);
      sink.setState(clearActiveTask(sink.getState()));
      return {
        ok: true,
        content: '用户切换了意图，已退出攻略收集。',
        data: { interrupted: true },
      };
    }

    const sink = asSink(runtime);
    const currentDraft = this.readDraft(sink.getState());
    const parsed = parseTravelGuideChatMessage(raw);
    const merged = mergeTravelGuideDraft(currentDraft, parsed);
    sink.setState(enterTravelGuideCollectState(merged));

    const missing = listMissingTravelGuideSlots(merged);
    if (missing.length > 0) {
      const reply = buildTravelGuideCollectPrompt(missing);
      sink.setReply(reply);
      return {
        ok: true,
        content: JSON.stringify({ missingSlots: missing, slots: merged }),
        data: { missingSlots: missing },
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          this.sseBuilder.openSheetPromptAction('travel_guide'),
          this.sseBuilder.conversationPatchEvent(sink),
        ],
      };
    }

    return this.generate(input, runtime, merged);
  }

  async generate(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    draftOverride?: TravelGuideChatDraft,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动后再生成出行攻略。',
        error: 'activity_not_bound',
      };
    }

    const sink = asSink(runtime);
    const activity = await this.activityService.findByLegacyId(legacyId);
    const defaultNights = parseActivityDayCount(activity?.date);
    const draft = draftOverride ?? this.readDraft(sink.getState());
    const form = travelGuideDraftToForm(draft, defaultNights);

    if (!form) {
      const missing = listMissingTravelGuideSlots(draft);
      const reply = buildTravelGuideCollectPrompt(missing);
      sink.setReply(reply);
      sink.setState(mergeTravelGuideActiveTask(sink.getState(), draft));
      return {
        ok: false,
        content: JSON.stringify({ missingSlots: missing }),
        error: 'slots_incomplete',
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          this.sseBuilder.openSheetPromptAction('travel_guide'),
          this.sseBuilder.conversationPatchEvent(sink),
        ],
      };
    }

    try {
      const { plan } = await this.generationService.generate(
        legacyId,
        {
          departure: form.departure,
          departureCity: form.departureCity,
          headcount: form.headcount,
          budgetTier: form.budgetTier,
          selfDrive: form.selfDrive,
          accommodationNights: form.accommodationNights,
        },
        input.dto.actor,
      );

      const guideId = input.requestId || randomUUID();
      const chatForm: TravelGuideChatForm = {
        departure: form.departure,
        departureCity: form.departureCity,
        headcount: form.headcount,
        budgetTier: form.budgetTier,
        selfDrive: form.selfDrive,
        accommodationNights: form.accommodationNights,
      };
      const reply = '已为你生成出行攻略，点击查看完整方案～';
      sink.setReply(reply);
      sink.setState(clearActiveTask(sink.getState()));

      return {
        ok: true,
        content: 'travel_guide_generated',
        data: { guideId },
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          {
            type: 'travel_guide_ready',
            guideId,
            plan: plan as unknown as Record<string, unknown>,
            form: chatForm,
          },
          this.sseBuilder.conversationPatchEvent(sink),
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '攻略生成失败，请稍后重试';
      this.logger.warn(`travel guide tool generate failed: ${message}`);
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

  private readDraft(state: ReturnType<ChatAgentRuntime['getState']>) {
    return state.activeTask?.kind === 'travel_guide'
      ? state.activeTask.travelGuide
      : {};
  }
}
