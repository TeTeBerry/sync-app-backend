import { IsString, MinLength } from 'class-validator';

export class VerifyCosUploadDto {
  @IsString()
  @MinLength(12)
  url!: string;
}
