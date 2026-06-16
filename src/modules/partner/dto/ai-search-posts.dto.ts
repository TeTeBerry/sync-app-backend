import { IsNumber, IsString, MinLength } from 'class-validator';

export class AiSearchPostsDto {
  @IsString()
  @MinLength(1)
  query: string;

  @IsNumber()
  activityLegacyId: number;
}
