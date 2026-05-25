import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { PindanJoinCardView as PindanJoinCardDto } from '../presentation/pindan-join-card.view';
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function shouldHandleStructuredReply(
  _state: ConversationState,
  _messages: ChatMessageDto[],
  _input: string,
): boolean {
  // TODO: 当前未实现，保留作为功能开关入口
  // 启用时需同时实现 buildStructuredReply
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
