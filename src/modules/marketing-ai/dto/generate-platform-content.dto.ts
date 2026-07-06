import { IsIn, IsObject, IsString } from 'class-validator';

export const MARKETING_PLATFORMS = [
  'threads',
  'instagram',
  'tiktok',
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
}
