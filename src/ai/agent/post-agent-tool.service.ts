import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { enterCollectPostBodyState } from '../conversation';
import { PostIntentService } from '../post-intent.service';
import {
  AiStreamEventBuilder,
  type ReplySink,
} from '../presentation/ai-stream-event.builder';
import {
  buildCollectPostBodyPromptReply,
  COLLECT_POST_BODY_SUGGESTED_REPLIES,
} from '../publish/buddy-post-flow.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
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
export class PostAgentToolService {
  constructor(
    private readonly postIntent: PostIntentService,
    private readonly activityService: ActivityService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async startCollect(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '当前未绑定活动，请先进入活动页再发帖。',
        error: 'activity_not_bound',
      };
    }

    const activity = await this.activityService.findByLegacyId(legacyId);
    const reply = buildCollectPostBodyPromptReply(
      activity?.name?.trim() || '活动',
    );
    const sink = asSink(runtime);
    sink.setReply(reply);
    sink.setState(
      enterCollectPostBodyState({
        activityLegacyId: legacyId,
        fromSelfPost: true,
      }),
    );

    return {
      ok: true,
      content: '已进入组队帖信息收集流程，等待用户填写。',
      terminal: true,
      replyOverride: reply,
      streamEvents: [
        { type: 'delta', content: reply },
        {
          type: 'suggested_replies',
          replies: [...COLLECT_POST_BODY_SUGGESTED_REPLIES],
        },
        this.sseBuilder.openSheetPromptAction('buddy_post'),
        this.sseBuilder.conversationPatchEvent(sink),
      ],
    };
  }

  async submit(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
    body?: string,
  ): Promise<ChatAgentToolExecutionResult> {
    const text = (body ?? input.input).trim();
    if (!text) {
      return {
        ok: false,
        content: '帖子正文不能为空。',
        error: 'empty_body',
      };
    }

    const sink = asSink(runtime);
    const attempt = await this.postIntent.tryCreatePostFromChat({
      messages: input.messages,
      input: text,
      actor: input.dto.actor,
      activityLegacyId: input.dto.activityLegacyId,
      conversationState: sink.getState(),
      onStateChange: (state) => sink.setState(state),
      fromAgentTool: true,
    });

    if (!attempt) {
      return {
        ok: false,
        content: '无法提交帖子：请确认已绑定活动，且正文包含组队信息。',
        error: 'post_not_ready',
      };
    }

    const streamEvents = this.sseBuilder.eventsFromPostAttempt(attempt, sink);
    return {
      ok: true,
      content: `post_${attempt.kind}`,
      data: { kind: attempt.kind },
      terminal: true,
      replyOverride: sink.getReply(),
      streamEvents,
    };
  }

  async confirmPublish(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
  ): Promise<ChatAgentToolExecutionResult> {
    const confirmText = isPublishConfirmIntent(input.input.trim())
      ? input.input.trim()
      : '确认发布';
    return this.submit(input, runtime, confirmText);
  }
}
