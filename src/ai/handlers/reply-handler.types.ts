import { ChatMessageDto, PindanJoinCardDto } from '../dto/chat.dto';
import type { ConversationState } from '../conversation';

export interface DeterministicReplyResult {
  text: string;
  ticketId?: string;
  pindanCard?: PindanJoinCardDto;
  nextState: ConversationState;
}

export interface ReplyContext {
  messages: ChatMessageDto[];
  input: string;
  state: ConversationState;
  userId?: string;
  userName?: string;
  onTicketCreated?: (ticketId: string) => void;
}

export interface ReplyHandler {
  canHandle(ctx: ReplyContext): boolean | Promise<boolean>;
  handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null>;
}

export const REPLY_HANDLER = Symbol('REPLY_HANDLER');
