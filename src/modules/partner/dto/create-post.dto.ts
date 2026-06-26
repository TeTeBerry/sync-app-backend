import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAX_RECRUIT_UNITY_TAGS,
  RECRUIT_UNITY_TAG_IDS,
} from '@sync/partner-contracts';

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RECRUIT_UNITY_TAGS)
  @IsIn(RECRUIT_UNITY_TAG_IDS, { each: true })
  recruitUnityTags?: string[];

  /** Default true. False = save post but hide from activity/popular feeds. */
  @IsOptional()
  @IsBoolean()
  listedInFeed?: boolean;

  @IsOptional()
  @IsIn(['open', 'full'])
  recruitStatus?: 'open' | 'full';

  @IsOptional()
  @IsNumber()
  @Min(1)
  slotsTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slotsFilled?: number;
}
