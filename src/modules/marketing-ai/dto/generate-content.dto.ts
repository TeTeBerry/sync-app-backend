import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { CONTENT_SERIES, type ContentSeries } from '../content-series.types';
import {
  MARKETING_PLATFORMS,
  type MarketingPlatform,
} from './generate-platform-content.dto';

export class GenerateContentDto {
  @IsString()
  brandVoice!: string;

  @IsObject()
  festival!: Record<string, unknown>;

  @IsIn(CONTENT_SERIES)
  seriesType!: ContentSeries;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(MARKETING_PLATFORMS, { each: true })
  platforms!: MarketingPlatform[];

  @IsString()
  language!: string;

  @IsOptional()
  @IsString()
  artistName?: string;

  @IsOptional()
  @IsString()
  topicHint?: string;
}

export type { ContentSeries };
