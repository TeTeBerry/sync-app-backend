import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { InstagramAssetRequest } from '../marketing-ai-instagram-asset.types';

export class InstagramAssetFestivalDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  dates?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  artists?: string[];
}

export class InstagramAssetPublishingPackageDto {
  @IsString()
  @MinLength(1)
  topic!: string;

  @IsString()
  @MinLength(1)
  caption!: string;

  @IsArray()
  @IsString({ each: true })
  hashtags!: string[];

  @IsOptional()
  @IsString()
  publishTime?: string;
}

export class InstagramAssetBrandStyleDto {
  @IsIn(['Raven'])
  brandName!: 'Raven';

  @IsIn(['premium', 'minimal', 'editorial'])
  mood!: 'premium' | 'minimal' | 'editorial';

  @IsIn(['dark'])
  background!: 'dark';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  colorPalette!: string[];

  @IsIn(['clean sans-serif'])
  typography!: 'clean sans-serif';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  visualTone!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  avoid!: string[];
}

export class CarouselSlideAssetInputDto {
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

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  imageDescription!: string;

  @IsArray()
  @IsString({ each: true })
  overlayText!: string[];

  @IsIn(['4:5'])
  aspectRatio!: '4:5';
}

export class GenerateInstagramAssetsDto implements InstagramAssetRequest {
  @ValidateNested()
  @Type(() => InstagramAssetFestivalDto)
  festival!: InstagramAssetFestivalDto;

  @ValidateNested()
  @Type(() => InstagramAssetPublishingPackageDto)
  publishingPackage!: InstagramAssetPublishingPackageDto;

  @ValidateNested()
  @Type(() => InstagramAssetBrandStyleDto)
  brandStyle!: InstagramAssetBrandStyleDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CarouselSlideAssetInputDto)
  carousel!: CarouselSlideAssetInputDto[];
}
