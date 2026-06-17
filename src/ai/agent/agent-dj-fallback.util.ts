import type { DjInfoStructuredQuery } from '../dj/dj-info-structured.types';

/** Agent 未调工具时，判断 LLM 解析出的 DJ 查询是否值得自动查库 */
export function isActionableDjQuery(
  query: DjInfoStructuredQuery,
  activityLegacyId?: number,
): boolean {
  const artist = query.artistName?.trim() || query.referenceArtist?.trim();
  if (!artist) {
    if (
      query.intent === 'lineup_overview' &&
      activityLegacyId != null &&
      !Number.isNaN(activityLegacyId)
    ) {
      return true;
    }
    return false;
  }

  switch (query.intent) {
    case 'artist_performances':
    case 'artist_profile':
    case 'artist_discography':
    case 'similar_artists':
      return true;
    case 'by_style':
      return query.styles.length > 0;
    case 'lineup_by_style':
      return query.styles.length > 0;
    default:
      return false;
  }
}
