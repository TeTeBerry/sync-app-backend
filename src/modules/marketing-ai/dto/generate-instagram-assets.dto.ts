import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InstagramCarouselSlideDto {
  @IsInt()
  @Min(1)
  slide!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  headline!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;
}

export class GenerateInstagramAssetsDto {
  @IsObject()
  festival!: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  caption!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramCarouselSlideDto)
  carousel!: InstagramCarouselSlideDto[];

  @IsString()
  @MinLength(1)
  brandStyle!: string;

  @IsString()
  @MinLength(2)
  language!: string;
}
