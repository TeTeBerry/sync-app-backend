import { Injectable } from '@nestjs/common';
import { PostAgentToolService } from '../post-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class PostSubmitTool implements ChatAgentTool {
  readonly definition = {
    name: 'post_submit',
    description:
      '提交组队帖正文并尝试发布。在 collect_post_body 流程中用户给出正文时调用；也可在参数 body 中传入正文。',
    parameters: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: '组队帖正文（活动时间、集合点、人数、备注等）',
        },
      },
    },
  };

  constructor(private readonly postTools: PostAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const body = typeof args.body === 'string' ? args.body : undefined;
    return this.postTools.submit(input, input.runtime, body);
  }
}
