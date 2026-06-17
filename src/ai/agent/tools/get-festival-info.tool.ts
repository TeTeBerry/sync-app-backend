import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { buildHomeFestivalShortcutReplyFromCatalog } from '../../utils/festival-shortcut.util';
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

    const reply = await buildHomeFestivalShortcutReplyFromCatalog(
      festivalName,
      (code) => this.activityService.findByCode(code).exec(),
    );

    if (!reply) {
      return {
        ok: false,
        content: `未识别电音节「${festivalName}」，可尝试风暴电音节、EDC Thailand、Tomorrowland。`,
        error: 'festival_not_found',
      };
    }

    return {
      ok: true,
      content: reply,
      data: { festivalName },
    };
  }
}
