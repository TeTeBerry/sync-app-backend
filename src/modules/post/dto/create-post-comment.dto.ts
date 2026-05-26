import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePostCommentDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}
