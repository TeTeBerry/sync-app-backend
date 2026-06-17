import { Injectable } from '@nestjs/common';
import { TravelGuideAgentToolService } from '../travel-guide-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class TravelGuideCollectSlotsTool implements ChatAgentTool {
  readonly definition = {
    name: 'travel_guide_collect_slots',
    description:
      '解析用户消息中的出行攻略参数（出发地、人数、预算、自驾、住宿晚数），合并到会话草稿；缺参则追问，齐全则生成攻略。',
    parameters: {
      type: 'object',
      properties: {
        userText: {
          type: 'string',
          description: '要解析的用户原文，默认使用当前轮用户消息',
        },
      },
    },
  };

  constructor(private readonly travelGuideTools: TravelGuideAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const userText =
      typeof args.userText === 'string' ? args.userText : undefined;
    return this.travelGuideTools.collectSlots(input, input.runtime, userText);
  }
}
