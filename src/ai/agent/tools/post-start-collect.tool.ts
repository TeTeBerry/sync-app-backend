import { Injectable } from '@nestjs/common';
import { PostAgentToolService } from '../post-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class PostStartCollectTool implements ChatAgentTool {
  readonly definition = {
    name: 'post_start_collect',
    description:
      '用户想发组队帖但尚未填写正文时，进入结构化收集流程（活动时间、出发地、人数、备注）。需已绑定活动。',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly postTools: PostAgentToolService) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.postTools.startCollect(input, input.runtime);
  }
}
