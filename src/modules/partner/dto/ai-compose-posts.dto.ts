import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

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

export class AiComposePostsDto {
  @Type(() => Number)
  @IsNumber()
  activityLegacyId: number;

  @IsString()
  @MinLength(1)
  dateStart: string;

  @IsString()
  @MinLength(1)
  dateEnd: string;

  @IsString()
  @MinLength(1)
  location: string;

  @IsString()
  @MinLength(1)
  headcount: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BuddyPostComposeHintsDto)
  composeHints?: BuddyPostComposeHintsDto;

  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
