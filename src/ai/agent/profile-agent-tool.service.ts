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
      `报名活动 ${summary.stats.events} 场 · 组队帖 ${summary.stats.posts} 条`,
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
        content: '你还没有报名任何活动，可以在活动详情页点击「加入」。',
        terminal: true,
      };
    }

    const lines = activities.slice(0, 8).map((item, index) => {
      const status = item.status === 'attended' ? '已参加' : '已报名';
      return `${index + 1}. ${item.title}（${item.date}）· ${status}`;
    });

    return {
      ok: true,
      content: ['你报名的活动：', '', ...lines].join('\n'),
      terminal: true,
      data: { count: activities.length },
    };
  }
}
