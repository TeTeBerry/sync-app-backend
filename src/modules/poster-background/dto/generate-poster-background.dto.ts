import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GeneratePosterBackgroundDto {
  @IsIn(['set_vote', 'personality_test', 'trip_plan', 'countdown'])
  kind!: 'set_vote' | 'personality_test' | 'trip_plan' | 'countdown';

  @IsOptional()
  @IsInt()
  @Min(1)
  activityLegacyId?: number;

  @IsOptional()
  @IsString()
  activityName?: string;

  @IsOptional()
  @IsString()
  personalityType?: string;
}
