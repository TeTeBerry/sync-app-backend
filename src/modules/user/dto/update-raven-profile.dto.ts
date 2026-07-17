import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRavenProfileDto {
  @IsOptional() @IsString() @MaxLength(16) homeAirport?: string;
  @IsOptional() @IsString() @MaxLength(80) homeCity?: string;
  @IsOptional() @IsString() @MaxLength(80) homeCountry?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) favoriteGenres?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteArtistIds?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteFestivalIds?: string[];
}
