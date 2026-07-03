import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SearchFestivalsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  homeCity?: string;
}

export class SubscribeLineupUpdatesDto {
  @IsNumber()
  @Min(1)
  activityLegacyId!: number;

  @IsOptional()
  @IsBoolean()
  notifyWechat?: boolean;
}

export class GenerateTravelGuideCapabilityDto {
  @IsNumber()
  @Min(1)
  activityLegacyId!: number;

  @IsObject()
  formData!: Record<string, unknown>;
}
