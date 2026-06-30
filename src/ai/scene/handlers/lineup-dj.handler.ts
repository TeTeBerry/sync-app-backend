import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import type {
  LineupDjSceneContext,
  SceneRunRequest,
  SceneRunResponse,
} from '@sync/scene-contracts';
import { LlmService } from '../../../infra/llm/llm.service';
import { LineupCatalogService } from '../../../modules/itinerary/lineup-catalog.service';
import type { SceneHandler } from './scene-handler.interface';

const DJ_BIO_SYSTEM = `You are an electronic music knowledge assistant.
Given a DJ/artist name and their genre, write a concise, engaging intro (≤ 200 chars) for festival-goers.
Include: 1-2 signature achievements, typical sound/genre, and one fan-friendly fun fact.
Keep it PLUR, non-promotional, and suitable for a festival lineup card.
Return ONLY the bio text, no heading, no quotes.`;

function parseLineupDjContext(
  context: SceneRunRequest['context'],
): LineupDjSceneContext {
  if (!context || typeof context !== 'object') {
    throw new BadRequestException('缺少 DJ 信息上下文');
  }

  const artistName =
    typeof context.artistName === 'string' ? context.artistName.trim() : '';
  if (!artistName) {
    throw new BadRequestException('缺少艺人名称');
  }

  const activityLegacyId =
    typeof context.activityLegacyId === 'number' ? context.activityLegacyId : 0;
  if (!activityLegacyId || activityLegacyId <= 0) {
    throw new BadRequestException('缺少活动信息');
  }

  return {
    ...context,
    artistName,
    activityLegacyId,
    genre: typeof context.genre === 'string' ? context.genre.trim() : '',
    regenerate: context.regenerate === true,
  } as LineupDjSceneContext;
}

@Injectable()
export class LineupDjSceneHandler implements SceneHandler {
  readonly scene = 'lineup_dj' as const;
  private readonly logger = new Logger(LineupDjSceneHandler.name);

  constructor(
    private readonly llm: LlmService,
    private readonly lineupCatalog: LineupCatalogService,
  ) {}

  async run(
    request: SceneRunRequest,
    _actor: RequestActor,
  ): Promise<SceneRunResponse> {
    const ctx = parseLineupDjContext(request.context);

    let genre = ctx.genre ?? '';
    if (!genre) {
      try {
        const artists = await this.lineupCatalog.listLineupArtistsForActivities(
          [ctx.activityLegacyId],
        );
        const matched = artists.find(
          (a: Record<string, unknown>) =>
            String(a.artistName).toLowerCase() === ctx.artistName.toLowerCase(),
        );
        if (matched && 'genreLabel' in matched) {
          genre = (matched as Record<string, unknown>).genreLabel as string;
        }
      } catch {
        // lineup lookup is best-effort
      }
    }

    const userPrompt = [
      `Artist: ${ctx.artistName}`,
      genre ? `Genre: ${genre}` : '',
      `Activity legacy ID: ${ctx.activityLegacyId}`,
      '',
      'Write a concise intro (≤ 200 chars) for this artist on a festival lineup card.',
    ]
      .filter(Boolean)
      .join('\n');

    const bio =
      (await this.llm.invokeText(DJ_BIO_SYSTEM, userPrompt, 15000)) ??
      `${ctx.artistName} 是电子音乐界备受瞩目的艺人，等待现场见证 ✨`;

    return {
      effects: [
        {
          type: 'dj_bio',
          artistName: ctx.artistName,
          bio: bio.trim(),
          genres: genre ? [genre] : [],
          aiGenerated: true,
        },
      ],
      disclaimer: 'AI 生成艺人介绍，仅供参考',
    };
  }
}
