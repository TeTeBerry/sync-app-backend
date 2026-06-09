import { Injectable } from '@nestjs/common';
import { DjInfoService } from '../../dj/dj-info.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class QueryDjInfoTool implements ChatAgentTool {
  readonly definition = {
    name: 'query_dj_info',
    description:
      '查询 DJ/艺人风格、介绍，按曲风推荐相近艺人，或筛选当前活动阵容。结合多轮上下文理解用户意图后调用；参数可填你对意图的理解，服务端会再结合对话校验。',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: [
            'artist_profile',
            'artist_performances',
            'artist_discography',
            'similar_artists',
            'by_style',
            'lineup_by_style',
            'lineup_overview',
          ],
          description:
            'artist_profile=介绍；artist_performances=近期演出；artist_discography=代表作/曲目；similar_artists=相近艺人；by_style=按曲风；lineup_*=阵容',
        },
        artistName: {
          type: 'string',
          description: '目标艺人英文名（artist_profile）',
        },
        referenceArtist: {
          type: 'string',
          description:
            'similar_artists 的参考艺人；从上文提取，推荐结果会排除该艺人',
        },
        styles: {
          type: 'array',
          items: { type: 'string' },
          description: '曲风列表，如 Future Bass、Techno',
        },
        scope: {
          type: 'string',
          enum: ['catalog', 'lineup', 'auto'],
          description: 'catalog=艺人库；lineup=当前活动阵容；auto=自动',
        },
      },
      required: ['intent'],
    },
  };

  constructor(private readonly djInfoService: DjInfoService) {}

  async execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const { replyText, query } = await this.djInfoService.answerFromChat(
      input.input.trim(),
      input.dto.activityLegacyId,
      { messages: input.messages, toolArgs: args },
    );

    return {
      ok: true,
      content: replyText,
      data: { toolArgs: args, query },
    };
  }
}
