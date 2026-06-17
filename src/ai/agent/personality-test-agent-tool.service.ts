import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersonalityTestService } from '../../modules/personality-test/personality-test.service';
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
export class PersonalityTestAgentToolService {
  constructor(
    private readonly personalityTest: PersonalityTestService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  async getSavedResult(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
  ): Promise<ChatAgentToolExecutionResult> {
    const userId = input.dto.actor.resolvedUserId?.trim() ?? '';
    if (!userId) {
      return this.openSheet(input, runtime);
    }

    const result = await this.personalityTest.getSavedResult(userId);
    if (!result) {
      const reply =
        '你还没有完成 Raver 人格测试，点下方按钮开始测试，完成后可推荐契合 DJ 与活动。';
      const sink = asSink(runtime);
      sink.setReply(reply);
      return {
        ok: true,
        content: 'no_saved_result',
        terminal: true,
        replyOverride: reply,
        streamEvents: [
          { type: 'delta', content: reply },
          this.sseBuilder.openSheetPromptAction('personality_test'),
        ],
      };
    }

    const resultId = input.requestId || randomUUID();
    const reply = `你的 Raver 人格是「${result.narrative.tagline}」，灵魂 DJ 是 ${result.recommendations.soulMatch.djName}。`;
    const sink = asSink(runtime);
    sink.setReply(reply);

    return {
      ok: true,
      content: reply,
      terminal: true,
      replyOverride: reply,
      streamEvents: [
        { type: 'delta', content: reply },
        {
          type: 'personality_result_ready',
          resultId,
          tagline: result.narrative.tagline,
          primaryType: result.score.primaryType,
          soulMatchDjName: result.recommendations.soulMatch.djName,
          result: result as unknown as Record<string, unknown>,
        },
      ],
    };
  }

  async openSheet(
    input: ChatAgentTurnInput,
    runtime: ChatAgentRuntime,
  ): Promise<ChatAgentToolExecutionResult> {
    const reply =
      'Raver 人格测试约 2 分钟，完成后会推荐契合 DJ 与活动。点下方按钮开始～';
    const sink = asSink(runtime);
    sink.setReply(reply);

    return {
      ok: true,
      content: 'opened_personality_test_sheet',
      terminal: true,
      replyOverride: reply,
      streamEvents: [
        { type: 'delta', content: reply },
        this.sseBuilder.openSheetPromptAction('personality_test'),
      ],
    };
  }
}
