import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ACTIVITY_TYPES } from '../utils/activity-type.util';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsIn([...ACTIVITY_TYPES])
  activityType?: (typeof ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  hot?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  attendees?: number;
}
