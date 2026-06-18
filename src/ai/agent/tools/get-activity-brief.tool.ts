import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class GetActivityBriefTool implements ChatAgentTool {
  readonly definition = {
    name: 'get_activity_brief',
    description:
      '获取当前已绑定活动的名称、日期、地点摘要。仅在用户已进入某活动上下文时使用。',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly activityService: ActivityService) {}

  async execute(
    input: ChatAgentTurnInput,
  ): Promise<ChatAgentToolExecutionResult> {
    const legacyId = input.dto.activityLegacyId;
    if (legacyId == null || Number.isNaN(legacyId)) {
      return {
        ok: false,
        content: '当前未绑定活动，无法查询活动摘要。',
        error: 'activity_not_bound',
      };
    }

    const activity = await this.activityService.findByLegacyId(legacyId);
    if (!activity) {
      return {
        ok: false,
        content: `未找到活动 legacyId=${legacyId}。`,
        error: 'activity_not_found',
      };
    }

    const lines = [
      `🎧 ${activity.name?.trim() || '活动'}`,
      activity.date?.trim() ? `📅 档期：${activity.date.trim()}` : '',
      activity.location?.trim() ? `📍 地点：${activity.location.trim()}` : '',
      '',
      '需要查 DJ 风格或阵容可以具体问我，例如「有哪些 Techno DJ」。',
    ].filter(Boolean);

    return {
      ok: true,
      content: lines.join('\n'),
      terminal: true,
      data: {
        activityLegacyId: legacyId,
        name: activity.name,
      },
    };
  }
}
