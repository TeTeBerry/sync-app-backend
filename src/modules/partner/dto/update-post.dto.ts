import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsString()
  eventTitle?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  departureCity?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
