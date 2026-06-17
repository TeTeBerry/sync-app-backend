import { Injectable } from '@nestjs/common';
import { TravelGuideAgentToolService } from '../travel-guide-agent-tool.service';
import type { TravelGuideChatDraft } from '../travel-guide-chat-slots.util';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class TravelGuideGenerateTool implements ChatAgentTool {
  readonly definition = {
    name: 'travel_guide_generate',
    description:
      '在攻略参数已齐全时生成出行攻略卡片。通常由 travel_guide_collect_slots 自动触发，仅在参数已明确时使用。',
    parameters: {
      type: 'object',
      properties: {
        departure: { type: 'string' },
        departureCity: { type: 'string' },
        headcount: { type: 'number' },
        budgetTier: {
          type: 'string',
          enum: ['economy', 'standard', 'comfort'],
        },
        selfDrive: { type: 'boolean' },
        accommodationNights: { type: 'number' },
      },
    },
  };

  constructor(private readonly travelGuideTools: TravelGuideAgentToolService) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const draft: TravelGuideChatDraft = {
      departure:
        typeof args.departure === 'string' ? args.departure : undefined,
      departureCity:
        typeof args.departureCity === 'string' ? args.departureCity : undefined,
      headcount:
        typeof args.headcount === 'number' ? args.headcount : undefined,
      budgetTier:
        args.budgetTier === 'economy' ||
        args.budgetTier === 'standard' ||
        args.budgetTier === 'comfort'
          ? args.budgetTier
          : undefined,
      selfDrive:
        typeof args.selfDrive === 'boolean' ? args.selfDrive : undefined,
      accommodationNights:
        typeof args.accommodationNights === 'number'
          ? args.accommodationNights
          : undefined,
    };
    return this.travelGuideTools.generate(input, input.runtime, draft);
  }
}
