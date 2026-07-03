import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PatchTravelGuideFormDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  departure?: string;

  @IsOptional()
  @IsString()
  departureCity?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  headcount?: number;

  @IsOptional()
  @IsIn(['economy', 'standard', 'comfort'])
  budgetTier?: 'economy' | 'standard' | 'comfort';

  @IsOptional()
  @IsBoolean()
  selfDrive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  accommodationNights?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
