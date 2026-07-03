import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTripPlanDto {
  @IsInt()
  activityLegacyId!: number;
}

export class UpdateTripPlanDto {
  @IsOptional()
  @IsString()
  guideId?: string;

  @IsOptional()
  @IsString()
  itineraryId?: string;

  @IsOptional()
  @IsString()
  travelPlanId?: string;
}

export class JoinTripPlanDto {
  @IsString()
  shareToken!: string;
}
