import { Injectable } from '@nestjs/common';
import { ItineraryAgentToolService } from '../itinerary-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class ItineraryGetScheduleTool implements ChatAgentTool {
  readonly definition = {
    name: 'itinerary_get_schedule',
    description: '获取当前绑定活动的演出日程/阵容概况（只读）。',
    parameters: { type: 'object', properties: {} },
  };

  constructor(private readonly itineraryTools: ItineraryAgentToolService) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.itineraryTools.getSchedule(input);
  }
}

@Injectable()
export class ItineraryOpenSheetTool implements ChatAgentTool {
  readonly definition = {
    name: 'itinerary_open_sheet',
    description: '用户想生成专属演出行程但尚未选择 DJ 时，打开选 DJ 页面。',
    parameters: { type: 'object', properties: {} },
  };

  constructor(private readonly itineraryTools: ItineraryAgentToolService) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.itineraryTools.openSheet(input, input.runtime);
  }
}

@Injectable()
export class ItineraryCollectAndGenerateTool implements ChatAgentTool {
  readonly definition = {
    name: 'itinerary_collect_and_generate',
    description:
      '从用户消息解析想看的 DJ 并生成专属演出行程；参数齐全或有人格测试推荐时直接生成。',
    parameters: {
      type: 'object',
      properties: {
        userText: { type: 'string' },
        selectedDjIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  };

  constructor(private readonly itineraryTools: ItineraryAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const userText =
      typeof args.userText === 'string' ? args.userText : undefined;
    const selectedDjIds = Array.isArray(args.selectedDjIds)
      ? args.selectedDjIds.filter((id): id is string => typeof id === 'string')
      : undefined;
    return this.itineraryTools.collectAndGenerate(
      input,
      input.runtime,
      userText,
      selectedDjIds,
    );
  }
}

@Injectable()
export class ItineraryGenerateTool implements ChatAgentTool {
  readonly definition = {
    name: 'itinerary_generate',
    description:
      '在已明确 selectedDjIds 时生成专属演出行程（通常由 itinerary_collect_and_generate 自动触发）。',
    parameters: {
      type: 'object',
      properties: {
        selectedDjIds: {
          type: 'array',
          items: { type: 'string' },
        },
        dateKey: { type: 'string' },
      },
      required: ['selectedDjIds'],
    },
  };

  constructor(private readonly itineraryTools: ItineraryAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const selectedDjIds = Array.isArray(args.selectedDjIds)
      ? args.selectedDjIds.filter((id): id is string => typeof id === 'string')
      : [];
    const dateKey = typeof args.dateKey === 'string' ? args.dateKey : undefined;
    return this.itineraryTools.generate(
      input,
      input.runtime,
      selectedDjIds,
      dateKey,
    );
  }
}
