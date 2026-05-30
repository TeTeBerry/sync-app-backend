import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LIVE_INFO_CATEGORY_IDS } from '../domain/live-info-categories';

export class LiveInfoRatingDto {
  @IsIn(LIVE_INFO_CATEGORY_IDS)
  categoryId!: (typeof LIVE_INFO_CATEGORY_IDS)[number];

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class PublishLiveInfoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LiveInfoRatingDto)
  ratings!: LiveInfoRatingDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  remark?: string;
}
