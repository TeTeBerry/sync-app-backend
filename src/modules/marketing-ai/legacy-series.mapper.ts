import type { ContentSeries } from './content-series.types';
import type {
  MarketingContentType,
  MarketingPlatform,
} from './dto/generate-platform-content.dto';

export function inferSeriesFromLegacy(
  contentType: MarketingContentType,
  platform: MarketingPlatform,
  festival: Record<string, unknown>,
): ContentSeries {
  const plannerType =
    typeof festival.plannerContentType === 'string'
      ? festival.plannerContentType
      : undefined;

  if (plannerType === 'artist') {
    return 'artist_spotlight';
  }

  if (typeof festival.seriesType === 'string') {
    return festival.seriesType as ContentSeries;
  }

  switch (contentType) {
    case 'news':
      return 'news_update';
    case 'discussion':
    case 'hook':
      return 'community_discussion';
    case 'seo':
      return 'festival_guide';
    case 'guide':
    default:
      if (platform === 'instagram') {
        return 'travel_guide';
      }
      if (platform === 'reddit') {
        return 'festival_guide';
      }
      return plannerType === 'tips' ? 'packing_guide' : 'travel_guide';
  }
}

export function mapSeriesToLegacyContentType(
  series: ContentSeries,
): MarketingContentType {
  switch (series) {
    case 'news_update':
      return 'news';
    case 'community_discussion':
      return 'discussion';
    case 'festival_guide':
      return 'seo';
    case 'lineup_breakdown':
    case 'artist_spotlight':
    case 'festival_intelligence':
      return 'guide';
    case 'budget_guide':
    case 'packing_guide':
    case 'travel_guide':
      return 'guide';
    default:
      return 'guide';
  }
}
