import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  hot?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  attendees?: number;
}
