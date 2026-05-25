import { ChatMessageDto, PindanJoinCardDto } from '../dto/chat.dto';
import type { ConversationState } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import { ProfileService } from '../../modules/profile/profile.service';

export interface StructuredReplyResult {
  text: string;
  pindanCard?: PindanJoinCardDto;
  nextState: ConversationState;
}

export function shouldHandleStructuredReply(
  _state: ConversationState,
  _messages: ChatMessageDto[],
  _input: string,
): boolean {
  return false;
}

export async function buildStructuredReply(
  _messages: ChatMessageDto[],
  _input: string,
  _services: {
    pindanService: PindanService;
    activityService: ActivityService;
    ticketService: TicketService;
    profileService: ProfileService;
  },
  _context: { userId?: string; image?: string } = {},
  state: ConversationState,
): Promise<StructuredReplyResult | null> {
  return {
    text: '该结构化回复路径暂不启用。',
    nextState: state,
  };
}
