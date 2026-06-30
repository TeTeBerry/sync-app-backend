import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type {
  FestivalStorySceneContext,
  SceneRunRequest,
  SceneRunResponse,
} from '@sync/scene-contracts';
import { LlmService } from '../../../infra/llm/llm.service';
import { ActivityLookupService } from '../../../modules/activity/activity-lookup.service';
import type { SceneHandler } from './scene-handler.interface';

const FESTIVAL_STORY_SYSTEM = `You are a festival culture assistant.
Given a music festival's name, location, date, and lineup highlights, write a structured summary for festival-goers.
Output format (plain text, no JSON):
## 关于 {festivalName}
### 活动简介
2-3 sentences about the festival's vibe, history, and culture.
### 阵容亮点
2-3 bullet points about the lineup (use • prefix).
### 出行贴士
1-2 practical tips (weather, transport, PLUR reminders).
Keep total ≤ 400 chars. PLUR, non-promotional, suitable for in-app info card.`;

function parseFestivalStoryContext(
  context: SceneRunRequest['context'],
): FestivalStorySceneContext {
  if (!context || typeof context !== 'object') {
    throw new BadRequestException('缺少活动信息上下文');
  }

  const activityLegacyId =
    typeof context.activityLegacyId === 'number' ? context.activityLegacyId : 0;
  if (!activityLegacyId || activityLegacyId <= 0) {
    throw new BadRequestException('缺少活动信息');
  }

  return {
    ...context,
    activityLegacyId,
    regenerate: context.regenerate === true,
  } as FestivalStorySceneContext;
}

@Injectable()
export class FestivalStorySceneHandler implements SceneHandler {
  readonly scene = 'festival_story' as const;
  private readonly logger = new Logger(FestivalStorySceneHandler.name);

  constructor(
    private readonly llm: LlmService,
    private readonly activityLookup: ActivityLookupService,
  ) {}

  async run(
    request: SceneRunRequest,
    _actor: RequestActor,
  ): Promise<SceneRunResponse> {
    const ctx = parseFestivalStoryContext(request.context);

    let eventInfo: {
      name: string;
      location?: string;
      date?: string;
      description?: string;
    } = { name: `活动 ${ctx.activityLegacyId}` };

    try {
      const record = await this.activityLookup.findByLegacyId(
        ctx.activityLegacyId,
      );
      if (record && record.name) {
        eventInfo = {
          name: record.name,
          location: record.location ?? undefined,
          date: record.date ?? undefined,
          description: '',
        };
      }
    } catch {
      // lookup is best-effort; will use defaults
    }

    const userPrompt = [
      `Festival: ${eventInfo.name}`,
      eventInfo.location ? `Location: ${eventInfo.location}` : '',
      eventInfo.date ? `Date: ${eventInfo.date}` : '',
      eventInfo.description ? `Description: ${eventInfo.description}` : '',
      '',
      'Write a structured festival summary as instructed.',
    ]
      .filter(Boolean)
      .join('\n');

    const raw =
      (await this.llm.invokeText(FESTIVAL_STORY_SYSTEM, userPrompt, 15000)) ??
      `## 关于 ${eventInfo.name}\n### 活动简介\n这是一场值得期待的电子音乐节。\n### 阵容亮点\n• 阵容即将公布\n### 出行贴士\n• 关注官方通知获取最新信息`;

    const sections = this.parseStorySections(raw, eventInfo.name);

    return {
      effects: [
        {
          type: 'festival_story',
          title: eventInfo.name,
          sections,
          sources: ['AI 生成摘要'],
          aiGenerated: true,
        },
      ],
      disclaimer: 'AI 生成活动摘要，信息以官方为准',
    };
  }

  private parseStorySections(
    raw: string,
    fallbackTitle: string,
  ): { heading?: string; body: string }[] {
    const parts = raw.split(/### |## /).filter(Boolean);
    if (parts.length <= 1) {
      return [{ body: raw.trim() }];
    }

    const sections: { heading?: string; body: string }[] = [];
    for (const part of parts) {
      const lines = part.trim().split('\n');
      const heading = lines[0]?.trim();
      const body = lines.slice(1).join('\n').trim();
      if (heading && body) {
        sections.push({ heading, body });
      } else if (body) {
        sections.push({ body });
      }
    }

    return sections.length > 0 ? sections : [{ body: raw.trim() }];
  }
}
