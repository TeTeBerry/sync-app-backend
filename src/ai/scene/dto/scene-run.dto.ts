import { Type } from 'class-transformer';
import {
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

export class SceneContextDto implements SceneContext {
  @IsOptional()
  @IsString()
  trigger?: SceneContext['trigger'];

  @IsOptional()
  applyPreferenceRank?: boolean;

  @IsOptional()
  @IsString()
  locale?: string;

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
