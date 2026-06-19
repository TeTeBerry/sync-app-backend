import { Injectable } from '@nestjs/common';
import { ProfileSummaryService } from '../../modules/profile/profile-summary.service';
import type { ChatAgentTurnInput } from './agent.types';
import type { ChatAgentToolExecutionResult } from './tools/chat-agent-tool.types';

@Injectable()
export class ProfileAgentToolService {
  constructor(private readonly profileSummary: ProfileSummaryService) {}

  async getSummary(
    input: ChatAgentTurnInput,
  ): Promise<ChatAgentToolExecutionResult> {
    const summary = await this.profileSummary.getSummary(input.dto.actor);
    const lines = [
      `昵称：${summary.name}`,
      summary.location ? `地区：${summary.location}` : '',
      summary.bio ? `简介：${summary.bio}` : '',
      `已选活动 ${summary.stats.events} 场 · 组队帖 ${summary.stats.posts} 条`,
    ].filter(Boolean);

    return {
      ok: true,
      content: lines.join('\n'),
      terminal: true,
      data: {
        events: summary.stats.events,
        posts: summary.stats.posts,
      },
    };
  }

  async listRegistrations(
    input: ChatAgentTurnInput,
  ): Promise<ChatAgentToolExecutionResult> {
    const activities = await this.profileSummary.listActivities(
      input.dto.actor,
    );
    if (!activities.length) {
      return {
        ok: true,
        content:
          '你还没有选择任何活动，可以在活动 Tab 浏览或进入活动详情页选择。',
        terminal: true,
      };
    }

    const lines = activities.slice(0, 8).map((item, index) => {
      const status = item.status === 'attended' ? '已参加' : '已选择';
      return `${index + 1}. ${item.title}（${item.date}）· ${status}`;
    });

    return {
      ok: true,
      content: ['你选择的活动：', '', ...lines].join('\n'),
      terminal: true,
      data: { count: activities.length },
    };
  }
}
