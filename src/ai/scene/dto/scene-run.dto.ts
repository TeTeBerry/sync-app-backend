import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { SceneContext, SceneId } from '@sync/scene-contracts';

const SCENE_IDS: SceneId[] = [
  'recruit_search',
  'recruit_compose',
  'prep_nudge',
  'events_knowledge_search',
];

class BuddyPostComposeHintsDto {
  @IsOptional()
  @IsString()
  personalityType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favorGenres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  setPicks?: string[];

  @IsOptional()
  @IsString()
  prefillSummary?: string;
}

export class SceneContextDto implements SceneContext {
  @IsOptional()
  @IsString()
  trigger?: SceneContext['trigger'];

  @IsOptional()
  applyPreferenceRank?: boolean;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  dateStart?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  dateEnd?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  headcount?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BuddyPostComposeHintsDto)
  composeHints?: BuddyPostComposeHintsDto;

  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;

  [key: string]: unknown;
}

export class SceneRunDto {
  @IsIn(SCENE_IDS)
  scene!: SceneId;

  @IsOptional()
  @IsString()
  intent?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  activityLegacyId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  input?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SceneContextDto)
  context?: SceneContextDto;
}
