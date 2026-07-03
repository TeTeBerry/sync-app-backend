import {
  IsArray,
  IsBoolean,
  IsIn,
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

  @IsIn(['green', 'pink'])
  variant!: 'green' | 'pink';
}

class ItineraryTimelineItemDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsString()
  @MaxLength(32)
  time!: string;

  @IsIn(['pink', 'cyan', 'purple'])
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
  @MaxLength(32)
  timeTag?: string;

  @IsOptional()
  @IsIn(['pink', 'cyan', 'purple'])
  timeTagColor?: 'pink' | 'cyan' | 'purple';

  @IsOptional()
  @ValidateNested()
  @Type(() => ItineraryTimelinePillDto)
  pill?: ItineraryTimelinePillDto;

  @IsOptional()
  @IsBoolean()
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

class ItineraryMeetupDto {
  @IsString()
  @MaxLength(120)
  stageLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  dateKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeRange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => ItineraryMeetupDto)
  meetup?: ItineraryMeetupDto;
}
