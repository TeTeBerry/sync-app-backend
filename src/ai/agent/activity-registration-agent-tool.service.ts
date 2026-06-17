import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { ActivityRegistrationService } from '../../modules/activity/registration/activity-registration.service';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-stream-event.builder';
import type { ChatAgentRuntime, ChatAgentTurnInput } from './agent.types';
import type { ChatAgentToolExecutionResult } from './tools/chat-agent-tool.types';

function asSink(runtime: ChatAgentRuntime): ReplySink {
  return {
    setReply: (text) => runtime.setReply(text),
    getReply: () => runtime.getReply(),
    setState: (state) => runtime.setState(state),
    getState: () => runtime.getState(),
  };
}

@Injectable()
export class ActivityRegistrationAgentToolService {
  constructor(
    private readonly registration: ActivityRegistrationService,
    private readonly activityService: ActivityService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async register(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    activityLegacyId?: number,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = activityLegacyId ?? input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请先进入活动或指定要报名的活动。',
        error: 'activity_not_bound',
      };
    }

    try {
      const result = await this.registration.register(
        legacyId,
        input.dto.actor,
      );
      const activity = await this.activityService.findByLegacyId(legacyId);
      const title = activity?.name?.trim();
      const reply = result.alreadyRegistered
        ? `你之前已报名「${title ?? '本场活动'}」，当前共 ${result.attendees} 人报名。`
        : `已帮你报名「${title ?? '本场活动'}」✅ 当前共 ${result.attendees} 人报名。`;

      const sink = asSink(runtime);
      sink.setReply(reply);

      return {
        ok: true,
        content: result.alreadyRegistered ? 'already_registered' : 'registered',
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          {
            type: 'activity_registered',
            activityLegacyId: legacyId,
            title,
            attendees: result.attendees,
            alreadyRegistered: result.alreadyRegistered,
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '报名失败，请稍后重试';
      return { ok: false, content: message, error: 'register_failed' };
    }
  }

  async unregister(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    activityLegacyId?: number,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = activityLegacyId ?? input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '请指定要取消报名的活动。',
        error: 'activity_not_bound',
      };
    }

    try {
      const result = await this.registration.unregister(
        legacyId,
        input.dto.actor,
      );
      const activity = await this.activityService.findByLegacyId(legacyId);
      const title = activity?.name?.trim();
      const reply = result.wasRegistered
        ? `已取消报名「${title ?? '本场活动'}」。`
        : `你尚未报名「${title ?? '本场活动'}」。`;

      runtime.setReply(reply);
      return {
        ok: true,
        content: reply,
        terminal: true,
        replyOverride: reply,
        streamEvents: [{ type: 'delta', content: reply }],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '取消报名失败，请稍后重试';
      return { ok: false, content: message, error: 'unregister_failed' };
    }
  }
}
