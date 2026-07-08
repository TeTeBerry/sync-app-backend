import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { CONTENT_SERIES, type ContentSeries } from '../content-series.types';

export const MARKETING_PLATFORMS = [
  'threads',
  'instagram',
  'tiktok',
  'seo',
  'x',
  'reddit',
] as const;

export const MARKETING_CONTENT_TYPES = [
  'news',
  'guide',
  'hook',
  'discussion',
  'seo',
] as const;

export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];
export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

export class GeneratePlatformContentDto {
  @IsString()
  brandVoice!: string;

  @IsObject()
  festival!: Record<string, unknown>;

  @IsIn(MARKETING_PLATFORMS)
  platform!: MarketingPlatform;

  @IsIn(MARKETING_CONTENT_TYPES)
  contentType!: MarketingContentType;

  @IsString()
  language!: string;

  @IsOptional()
  @IsIn(CONTENT_SERIES)
  seriesType?: ContentSeries;
}
