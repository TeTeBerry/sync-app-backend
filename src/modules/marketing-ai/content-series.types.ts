import type { MarketingPlatform } from './dto/generate-platform-content.dto';
import type { PlatformContentResult } from './marketing-ai.types';

export const CONTENT_SERIES = [
  'festival_guide',
  'travel_guide',
  'lineup_breakdown',
  'artist_spotlight',
  'festival_intelligence',
  'community_discussion',
  'budget_guide',
  'packing_guide',
  'news_update',
] as const;

export type ContentSeries = (typeof CONTENT_SERIES)[number];

export type ContentSeriesMeta = {
  id: ContentSeries;
  label: string;
  description: string;
  featured: boolean;
  requiresArtist?: boolean;
};

export const CONTENT_SERIES_META: ContentSeriesMeta[] = [
  {
    id: 'lineup_breakdown',
    label: 'Lineup Guide',
    description: 'Decide who to prioritize on the lineup',
    featured: true,
  },
  {
    id: 'artist_spotlight',
    label: 'Artist Guide',
    description: 'Decide if an artist matches your taste',
    featured: true,
    requiresArtist: true,
  },
  {
    id: 'travel_guide',
    label: 'Travel Guide',
    description: 'Decide where to stay, how to arrive, and how to prepare',
    featured: true,
  },
  {
    id: 'festival_intelligence',
    label: 'Festival Intelligence',
    description: 'Decide best days, stages, and schedule strategy',
    featured: true,
  },
  {
    id: 'festival_guide',
    label: 'Festival Guide',
    description: 'Long-form festival knowledge and SEO content',
    featured: false,
  },
  {
    id: 'community_discussion',
    label: 'Community Discussion',
    description: 'Hot takes, opinions, and fan conversations',
    featured: false,
  },
  {
    id: 'budget_guide',
    label: 'Budget Guide',
    description: 'Festival cost breakdown and money-saving tips',
    featured: false,
  },
  {
    id: 'packing_guide',
    label: 'Packing Guide',
    description: 'Festival preparation and packing essentials',
    featured: false,
  },
  {
    id: 'news_update',
    label: 'News Update',
    description: 'Festival announcements and lineup updates',
    featured: false,
  },
];

export type ContentGenerationResult = {
  seriesType: ContentSeries;
  platform: MarketingPlatform;
  topic: string;
  hook?: string;
  result: PlatformContentResult;
};
