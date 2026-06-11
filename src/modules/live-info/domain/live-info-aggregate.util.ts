import {
  LIVE_INFO_CATEGORY_IDS,
  type LiveInfoCategoryId,
} from '../../../shared/live-info';

export type LiveInfoSummaryRowDto = {
  categoryId: LiveInfoCategoryId;
  score: number;
};

export function aggregateLiveInfoSummary(
  updates: { ratings: { categoryId: LiveInfoCategoryId; score: number }[] }[],
): { summary: LiveInfoSummaryRowDto[]; certCount: number } {
  const buckets = new Map<LiveInfoCategoryId, number[]>();

  for (const id of LIVE_INFO_CATEGORY_IDS) {
    buckets.set(id, []);
  }

  for (const update of updates) {
    for (const rating of update.ratings) {
      if (!LIVE_INFO_CATEGORY_IDS.includes(rating.categoryId)) continue;
      buckets.get(rating.categoryId)?.push(rating.score);
    }
  }

  const summary: LiveInfoSummaryRowDto[] = LIVE_INFO_CATEGORY_IDS.map(
    (categoryId) => {
      const scores = buckets.get(categoryId) ?? [];
      if (scores.length === 0) {
        return { categoryId, score: 0 };
      }
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        categoryId,
        score: Math.round(avg * 10) / 10,
      };
    },
  );

  return { summary, certCount: updates.length };
}
