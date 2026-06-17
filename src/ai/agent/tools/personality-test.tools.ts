import { Injectable } from '@nestjs/common';
import { PersonalityTestAgentToolService } from '../personality-test-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class PersonalityTestGetResultTool implements ChatAgentTool {
  readonly definition = {
    name: 'personality_test_get_result',
    description:
      '获取用户已保存的 Raver 人格测试结果；若无结果则引导打开测试页。',
    parameters: { type: 'object', properties: {} },
  };

  constructor(
    private readonly personalityTools: PersonalityTestAgentToolService,
  ) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.personalityTools.getSavedResult(input, input.runtime);
  }
}

@Injectable()
export class PersonalityTestOpenTool implements ChatAgentTool {
  readonly definition = {
    name: 'personality_test_open',
    description: '用户想做 Raver 人格测试时，打开测试入口。',
    parameters: { type: 'object', properties: {} },
  };

  constructor(
    private readonly personalityTools: PersonalityTestAgentToolService,
  ) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.personalityTools.openSheet(input, input.runtime);
  }
}
