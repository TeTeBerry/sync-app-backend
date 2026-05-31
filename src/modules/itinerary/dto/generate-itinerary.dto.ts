import { ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateItineraryDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  selectedDjIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  dateKey?: string;
}
