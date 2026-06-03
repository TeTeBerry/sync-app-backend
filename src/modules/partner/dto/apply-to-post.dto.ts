import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyToPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
