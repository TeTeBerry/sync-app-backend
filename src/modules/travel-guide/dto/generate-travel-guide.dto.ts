import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateTravelGuideDto {
  @IsString()
  @MinLength(1)
  departure!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  headcount!: number;

  @IsIn(['economy', 'standard', 'comfort'])
  budgetTier!: 'economy' | 'standard' | 'comfort';

  @IsOptional()
  @IsBoolean()
  selfDrive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  accommodationNights?: number;
}
