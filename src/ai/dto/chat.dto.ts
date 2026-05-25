import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;

  /** 助手消息附带的拼单卡片（持久化供会话恢复） */
  pindanCard?: PindanJoinCardDto;

  /** 助手消息附带的门票卡片（持久化供会话恢复） */
  ticketCard?: TicketCreatedCardDto;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  userPhone?: string;

  /** 当前轮次上传的门票图片（data URL 或 base64），需 <10MB */
  @IsOptional()
  @IsString()
  image?: string;
}

export interface TicketCreatedCardDto {
  id: string;
  type: 'sell' | 'buy';
  event: string;
  seat: string;
  price: number;
  eventDate?: string;
}

export interface PindanJoinCardDto {
  legacyId: number;
  activityLegacyId?: number;
  category: 'package' | 'hotel' | 'transport';
  title: string;
  subtitle?: string;
  remark?: string;
  date: string;
  location: string;
  /** 人均费用（元/人） */
  price: number;
  pricePerPerson?: number;
  activityId?: string;
  userJoined?: boolean;
  isOwner?: boolean;
  joined?: number;
  total?: number;
}

export type AiStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'done';
      messageId?: string;
      sessionId?: string;
      ticketId?: string;
      ticketCard?: TicketCreatedCardDto;
      pindanCard?: PindanJoinCardDto;
    }
  | { type: 'error'; message: string };
