import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DevLoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;
}
