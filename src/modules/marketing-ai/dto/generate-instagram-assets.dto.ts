import { Type } from 'class-transformer';
import {
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
import type {
  InstagramAssetRequest,
  PosterSizeId,
} from '../marketing-ai-instagram-asset.types';

const POSTER_SIZE_IDS: PosterSizeId[] = [
  '4:5',
  '1:1',
  '9:16',
  '4:3',
  '16:9',
  'mobile',
  'desktop',
];

class InstagramAssetFestivalDto {
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

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

class InstagramAssetPublishingPackageDto {
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

class InstagramAssetBrandStyleDto {
  @IsIn(['Raven'])
  brandName!: 'Raven';

  @IsIn(['premium', 'minimal', 'editorial'])
  mood!: 'premium' | 'minimal' | 'editorial';

  @IsIn(['dark'])
  background!: 'dark';

  @IsArray()
  @IsString({ each: true })
  colorPalette!: string[];

  @IsIn(['clean sans-serif'])
  typography!: 'clean sans-serif';

  @IsArray()
  @IsString({ each: true })
  visualTone!: string[];

  @IsArray()
  @IsString({ each: true })
  avoid!: string[];
}

class CarouselSlideAssetInputDto {
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

  @IsIn(POSTER_SIZE_IDS)
  aspectRatio!: PosterSizeId;
}

export class GenerateInstagramAssetsDto implements InstagramAssetRequest {
  @IsOptional()
  @IsIn(POSTER_SIZE_IDS)
  outputSize?: PosterSizeId;

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
  @ValidateNested({ each: true })
  @Type(() => CarouselSlideAssetInputDto)
  carousel!: CarouselSlideAssetInputDto[];
}
