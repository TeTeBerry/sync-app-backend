import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ItineraryTimelinePillDto {
  @IsString()
  @MaxLength(64)
  label!: string;

  @IsString()
  variant!: 'green' | 'pink';
}

class ItineraryTimelineItemDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsString()
  @MaxLength(8)
  time!: string;

  @IsString()
  dotColor!: 'pink' | 'cyan' | 'purple';

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  timeTag?: string;

  @IsOptional()
  @IsString()
  timeTagColor?: 'pink' | 'cyan' | 'purple';

  @IsOptional()
  @ValidateNested()
  @Type(() => ItineraryTimelinePillDto)
  pill?: ItineraryTimelinePillDto;

  @IsOptional()
  highlighted?: boolean;
}

class ItineraryDayDto {
  @IsString()
  @MaxLength(32)
  id!: string;

  @IsString()
  @MaxLength(32)
  label!: string;

  @IsString()
  @MaxLength(32)
  bannerDateLabel!: string;

  @IsOptional()
  nodeCount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryTimelineItemDto)
  items!: ItineraryTimelineItemDto[];
}

export class SaveItineraryDto {
  @IsString()
  @MaxLength(200)
  eventMeta!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryDayDto)
  days!: ItineraryDayDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedDjIds?: string[];
}
