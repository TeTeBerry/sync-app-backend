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

export class GenerateTravelGuideDto {
  /** 客户端生成的攻略 ID，用于分享冷启动与服务端只读拉取 */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  guideId?: string;

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

  /** 重新生成时跳过 generation cache，避免切换出发地仍返回旧攻略 */
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
