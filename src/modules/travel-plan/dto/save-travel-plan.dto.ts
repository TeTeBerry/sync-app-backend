import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TravelPlanDiningBillItemDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsString()
  @MaxLength(10)
  startDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  startTime?: string;
}

export class TravelPlanNodeDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsIn(['flight', 'transport', 'hotel', 'dining', 'event'])
  category!: 'flight' | 'transport' | 'hotel' | 'dining' | 'event';

  @IsString()
  @MaxLength(10)
  startDate!: string;

  @IsString()
  @MaxLength(10)
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  startTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  duration?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(500)
  subtitle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsBoolean()
  confirmed!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelPlanDiningBillItemDto)
  diningBills?: TravelPlanDiningBillItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelPlanDiningBillItemDto)
  transportBills?: TravelPlanDiningBillItemDto[];
}

export class SaveTravelPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventMeta?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelPlanNodeDto)
  nodes!: TravelPlanNodeDto[];

  @IsOptional()
  @IsObject()
  activityConfirmations?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  activityPriceOverrides?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenActivityNodeIds?: string[];
}
