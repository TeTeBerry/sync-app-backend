import type { PublishLiveInfoDto } from '../dto/publish-live-info.dto';

/** Stable key for duplicate live-info detection (same user / same activity). */
export function liveInfoUpdateFingerprint(
  body: Pick<PublishLiveInfoDto, 'ratings' | 'remark'>,
): string {
  const ratings = [...body.ratings]
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId))
    .map((r) => `${r.categoryId}:${r.score}`)
    .join('|');
  const remark = body.remark?.trim().toLowerCase() ?? '';
  return `${ratings}::${remark}`;
}
