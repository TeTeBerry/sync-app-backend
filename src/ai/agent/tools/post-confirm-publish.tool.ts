import { Injectable } from '@nestjs/common';
import { PostAgentToolService } from '../post-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class PostConfirmPublishTool implements ChatAgentTool {
  readonly definition = {
    name: 'post_confirm_publish',
    description:
      '用户在 publish_confirm 流程中确认发布组队帖时调用（如用户说「确认发布」）。',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly postTools: PostAgentToolService) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.postTools.confirmPublish(input, input.runtime);
  }
}
