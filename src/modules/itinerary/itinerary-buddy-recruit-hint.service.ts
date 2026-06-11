import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ActivityService } from '../activity/activity.service';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../partner/interfaces/post.repository.interface';
import { ItineraryScheduleService } from './itinerary-schedule.service';

export type ItineraryBuddyRecruitHintDto = {
  recruitingCount: number;
  /** Primary genre label for copy, e.g. Techno */
  highlightGenre: string;
  /** All genre labels from selected DJs */
  genreLabels: string[];
};

function pickHighlightGenre(labels: string[]): string {
  if (!labels.length) return '';
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = label.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = labels[0]?.trim() ?? '';
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

@Injectable()
export class ItineraryBuddyRecruitHintService {
  constructor(
    private readonly scheduleService: ItineraryScheduleService,
    private readonly activityService: ActivityService,
    @Inject(POST_REPOSITORY)
    private readonly postRepository: IPostRepository,
  ) {}

  async getHint(
    activityLegacyId: number,
    selectedDjIds: string[],
    _actor: RequestActor,
  ): Promise<ItineraryBuddyRecruitHintDto> {
    const ids = [
      ...new Set(selectedDjIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!ids.length) {
      return { recruitingCount: 0, highlightGenre: '', genreLabels: [] };
    }

    const schedule = await this.scheduleService.getSchedule(activityLegacyId, {
      selectedDjIds: ids,
    });
    const selectedDjs = schedule.djs.filter((dj) => ids.includes(dj.id));
    const genreLabels = [
      ...new Set(selectedDjs.map((dj) => dj.genreLabel.trim()).filter(Boolean)),
    ];
    const highlightGenre = pickHighlightGenre(
      selectedDjs.map((dj) => dj.genreLabel),
    );

    if (!genreLabels.length) {
      return { recruitingCount: 0, highlightGenre, genreLabels };
    }

    await this.activityService.findByLegacyId(activityLegacyId);
    const recruiting =
      await this.postRepository.findRecruitingByActivityForMatch(
        activityLegacyId,
      );
    const recruitingAuthors = new Set(
      recruiting
        .map((post) => post.userId?.trim())
        .filter((uid): uid is string => Boolean(uid)),
    );

    return {
      recruitingCount: recruitingAuthors.size,
      highlightGenre,
      genreLabels,
    };
  }
}
