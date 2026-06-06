import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  content: string;
}
