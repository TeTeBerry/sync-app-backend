import { Type } from 'class-transformer';
import { IsNumber, IsString, MinLength } from 'class-validator';

export class AiSearchPostsDto {
  @IsString()
  @MinLength(1)
  query: string;

  @Type(() => Number)
  @IsNumber()
  activityLegacyId: number;
}
