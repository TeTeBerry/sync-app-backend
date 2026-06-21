import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  departureCity?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['open', 'full'])
  recruitStatus?: 'open' | 'full';

  @IsOptional()
  @IsNumber()
  @Min(1)
  slotsTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slotsFilled?: number;
}
