import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { RequestActorDto } from '../../common/auth/request-actor.dto';
import { ChatMessageDto } from '../../shared/chat/chat-message.dto';

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsString()
  sessionId?: string;

  /** Resolved by WS handler from JWT + body; required before `AiService.streamChat`. */
  @ValidateNested()
  @Type(() => RequestActorDto)
  actor!: RequestActorDto;

  @IsOptional()
  @IsString()
  userPhone?: string;

  /** Upload URL or legacy base64 data URL */
  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsNumber()
  activityLegacyId?: number;
}
