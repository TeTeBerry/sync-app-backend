import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsNumber()
  activityLegacyId?: number;

  @IsOptional()
  @IsString()
  eventTitle?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  departureCity?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** Default true. False = save post but hide from activity/popular feeds. */
  @IsOptional()
  @IsBoolean()
  listedInFeed?: boolean;
}
