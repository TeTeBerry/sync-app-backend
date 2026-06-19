import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsIn(['general', 'account_deletion'])
  type?: 'general' | 'account_deletion';
}
