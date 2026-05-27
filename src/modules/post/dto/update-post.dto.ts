import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { PostStatus } from '../../../database/schemas/post.schema';

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
  @IsIn(['recruiting', 'completed'])
  status?: PostStatus;
}
