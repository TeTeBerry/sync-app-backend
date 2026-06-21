import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import {
  buildActivityEnterConfirmationReply,
  toRecommendedActivityCard,
} from '../../utils/activity-enter.util';
import { resolveHomeFestivalShortcutCode } from '../../utils/festival-shortcut.util';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class GetFestivalInfoTool implements ChatAgentTool {
  readonly definition = {
    name: 'get_festival_info',
    description:
      '查询电音节基础信息：档期、地点、官宣阵容。用于风暴电音节、EDC Thailand、Tomorrowland 等。',
    parameters: {
      type: 'object',
      properties: {
        festivalName: {
          type: 'string',
          description:
            '电音节名称或用户提到的活动名，如 风暴电音节、EDC Thailand',
        },
      },
      required: ['festivalName'],
    },
  };

  constructor(private readonly activityService: ActivityService) {}

  async execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const festivalName =
      typeof args.festivalName === 'string' && args.festivalName.trim()
        ? args.festivalName.trim()
        : input.input.trim();

    const code = resolveHomeFestivalShortcutCode(festivalName);
    if (!code) {
      return {
        ok: false,
        content: `未识别电音节「${festivalName}」，可尝试风暴电音节、EDC Thailand、Tomorrowland。`,
        error: 'festival_not_found',
      };
    }

    const activity = await this.activityService.findByCode(code);
    if (!activity?.legacyId) {
      return {
        ok: false,
        content: `未找到电音节「${festivalName}」的 catalog 活动。`,
        error: 'festival_not_found',
      };
    }

    const card = toRecommendedActivityCard(activity);
    const replyText = buildActivityEnterConfirmationReply(card.title);

    return {
      ok: true,
      content: replyText,
      terminal: true,
      replyOverride: replyText,
      data: { festivalName, activityLegacyId: card.activityLegacyId },
      streamEvents: [
        { type: 'delta', content: replyText },
        { type: 'activity_recommendation', activity: card },
      ],
    };
  }
}
