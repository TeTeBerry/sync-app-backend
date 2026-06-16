import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { RecommendedActivityCard } from './chat-cards.types';

export class ChatMessageImageContextDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  ocrText?: string;
}

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system';

  @IsString()
  content!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatMessageImageContextDto)
  imageContext?: ChatMessageImageContextDto;

  @IsOptional()
  recommendedActivity?: RecommendedActivityCard;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedReplies?: string[];
}
