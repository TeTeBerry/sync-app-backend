import { IsIn, IsOptional, IsString } from 'class-validator';
import { PindanJoinCardView } from './pindan-join-card.view';
import { TicketCreatedCardView } from './ticket-created-card.view';

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;

  @IsOptional()
  pindanCard?: PindanJoinCardView;

  @IsOptional()
  ticketCard?: TicketCreatedCardView;
}
