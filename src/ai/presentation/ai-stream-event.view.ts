import { PindanJoinCardView } from './pindan-join-card.view';
import { TicketCreatedCardView } from './ticket-created-card.view';

export type AiStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'done';
      messageId?: string;
      sessionId?: string;
      ticketId?: string;
      ticketCard?: TicketCreatedCardView;
      pindanCard?: PindanJoinCardView;
    }
  | { type: 'error'; message: string };
