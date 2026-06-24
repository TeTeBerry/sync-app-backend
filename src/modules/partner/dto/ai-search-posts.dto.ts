import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AiSearchPostsDto {
  @IsString()
  @MinLength(1)
  query: string;

  @Type(() => Number)
  @IsNumber()
  activityLegacyId: number;

  /** When false, skip viewer preference tiebreaker in ranking. Defaults to true. */
  @IsOptional()
  @IsBoolean()
  applyPreferenceRank?: boolean;
}
