import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LightApplyDto {
  @IsString()
  @MaxLength(40)
  departureCity: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  tripDays?: number;

  @IsOptional()
  @IsString()
  @IsIn(['女生优先', '男生优先', '不限'])
  genderPref?: string;
}
