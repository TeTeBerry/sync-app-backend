import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchTripPlanOverlayDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  flights?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hotel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  arrivalAt?: string;

  @IsOptional()
  @IsBoolean()
  visibleToMembers?: boolean;
}
