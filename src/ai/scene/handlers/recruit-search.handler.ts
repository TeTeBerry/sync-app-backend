import { BadRequestException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { UserService } from '../../../modules/user/user.service';
import type { SceneRunRequest, SceneRunResponse } from '@sync/scene-contracts';
import { formatBuddyPostSearchParsedSummary } from '@sync/scene-contracts';
import { ActivityEngagementService } from '../../../modules/activity/engagement/activity-engagement.service';
import { PostService } from '../../../modules/partner/post.service';
import type { SceneHandler } from './scene-handler.interface';

function formatPreferenceSummary(profile: {
  city?: string;
  favorGenres?: string[];
  budgetLevel?: string;
}): string | null {
  const parts: string[] = [];
  if (profile.city?.trim()) parts.push(profile.city.trim());
  if (profile.favorGenres?.length) {
    const genres = profile.favorGenres.slice(0, 2).join('、');
    const more =
      profile.favorGenres.length > 2 ? `等${profile.favorGenres.length}种` : '';
    parts.push(`${genres}${more}`);
  }
  const budget = profile.budgetLevel?.trim();
  if (budget) {
    const label =
      budget === 'low'
        ? '经济'
        : budget === 'medium'
          ? '舒适'
          : budget === 'high'
            ? '充裕'
            : budget;
    parts.push(label);
  }
  return parts.length ? parts.join(' · ') : null;
}

@Injectable()
export class RecruitSearchSceneHandler implements SceneHandler {
  readonly scene = 'recruit_search' as const;

  constructor(
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly engagementService: ActivityEngagementService,
  ) {}

  async run(
    request: SceneRunRequest,
    actor: RequestActor,
  ): Promise<SceneRunResponse> {
    const input = request.input?.trim();
    const activityLegacyId = request.activityLegacyId;
    if (!input) {
      throw new BadRequestException('请输入检索需求');
    }
    if (
      !activityLegacyId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      throw new BadRequestException('活动信息无效');
    }

    const applyPreferenceRank = request.context?.applyPreferenceRank !== false;
    const result = await this.postService.searchPostsByNaturalLanguage(
      input,
      activityLegacyId,
      actor,
      { applyPreferenceRank },
    );

    const effects: SceneRunResponse['effects'] = [];

    const parsedSummary = formatBuddyPostSearchParsedSummary(result.parsed);
    if (parsedSummary) {
      effects.push({
        type: 'insight_line',
        text: parsedSummary,
        variant: 'parsed',
        aiGenerated: false,
      });
    }

    if (applyPreferenceRank) {
      const profile = await this.userService.resolveProfile(actor);
      if (profile) {
        const preferenceSummary = formatPreferenceSummary(profile);
        if (preferenceSummary) {
          effects.push({
            type: 'insight_line',
            text: preferenceSummary,
            variant: 'preference',
            aiGenerated: false,
          });
        }
      }
    }

    effects.push({
      type: 'reorder_posts',
      postIds: result.items.map((item) => item.id),
      items: result.items,
      totalMatched: result.totalMatched,
      totalScanned: result.totalScanned,
      parsed: result.parsed,
    });

    void this.engagementService.markRecruitSearched(actor, activityLegacyId);

    return { effects };
  }
}
