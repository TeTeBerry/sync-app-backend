import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LightApplyDto } from './light-apply.dto';

export class ApplyToPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LightApplyDto)
  lightApply?: LightApplyDto;
}
