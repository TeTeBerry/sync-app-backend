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

  /** POI 补全返回的城市（如「上海市」），地理编码时优先于活动举办城市 */
  @IsOptional()
  @IsString()
  departureCity?: string;

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
