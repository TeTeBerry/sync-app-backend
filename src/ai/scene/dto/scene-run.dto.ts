import { Type } from 'class-transformer';
import {
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
  'lineup_dj',
  'festival_story',
  'events_knowledge_search',
];

const SCENE_TRIGGERS: NonNullable<SceneContext['trigger']>[] = [
  'search',
  'chip',
  'sheet_submit',
  'page_enter',
];

export class SceneContextDto implements SceneContext {
  @IsOptional()
  @IsIn(SCENE_TRIGGERS)
  trigger?: SceneContext['trigger'];

  @IsOptional()
  applyPreferenceRank?: boolean;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  activityLegacyId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  artistName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  genre?: string;

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
