import type { ContentSeries } from '../../content-series.types';
import { mapSeriesToLegacyContentType } from '../../legacy-series.mapper';
import type { BuildMarketingPromptInput } from '../../marketing-ai.types';
import { resolveSeriesPrompt } from '../series';
import { resolvePlatformPrompt } from '../index';

export type SeriesFirstPromptInput = BuildMarketingPromptInput & {
  seriesType: ContentSeries;
  artistContext?: Record<string, unknown>;
  topicHint?: string;
};

export type ComposedPromptBundle = {
  system: string;
  user: string;
  contentStyle: string;
};

export function composeSeriesPlatformPrompt(
  input: SeriesFirstPromptInput,
): ComposedPromptBundle {
  const seriesBundle = resolveSeriesPrompt(input.seriesType);
  const platformBundle = resolvePlatformPrompt(input.platform);

  const legacyContentType = mapSeriesToLegacyContentType(input.seriesType);
  const platformInput: BuildMarketingPromptInput = {
    ...input,
    contentType: legacyContentType,
    festival: {
      ...input.festival,
      seriesType: input.seriesType,
      plannerContentType: mapPlannerContentType(input.seriesType),
    },
  };

  const seriesContext = seriesBundle.buildContextBlock({
    ...platformInput,
    seriesType: input.seriesType,
    artistContext: input.artistContext,
    topicHint: input.topicHint,
  });

  const platformUser = platformBundle.buildUserPrompt(platformInput);

  return {
    system: [seriesBundle.system, platformBundle.system].join('\n\n---\n\n'),
    user: [seriesContext, platformUser].join('\n\n'),
    contentStyle: platformBundle.contentStyle,
  };
}

function mapPlannerContentType(series: ContentSeries): string {
  switch (series) {
    case 'artist_spotlight':
      return 'artist';
    case 'community_discussion':
      return 'discussion';
    case 'news_update':
      return 'news';
    case 'packing_guide':
    case 'budget_guide':
      return 'tips';
    case 'lineup_breakdown':
    case 'festival_intelligence':
      return 'guide';
    default:
      return 'guide';
  }
}
