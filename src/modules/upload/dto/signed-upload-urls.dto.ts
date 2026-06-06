import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class SignedUploadUrlsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(12, { each: true })
  urls!: string[];
}
