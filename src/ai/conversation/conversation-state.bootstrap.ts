import { ChatMessageDto } from '../dto/chat.dto';
import {
  isFindBuddyThread,
  isTicketListingThread,
} from '../utils/conversation-context.parser';
import {
  parseTicketDraft,
  resolveTicketListingType,
} from '../utils/ticket-draft.parser';
import { detectUserIntent, isExactQuickReply } from '../utils/user-intent';
import {
  createIdleState,
  type ConversationState,
} from './conversation-state.types';
import { startFindBuddyFlow, startTicketListingFlow } from './conversation-state.machine';

/** 旧会话无结构化状态时，从历史消息推断一次 */
export function bootstrapConversationState(
  messages: ChatMessageDto[],
): ConversationState {
  if (!messages.length) {
    return createIdleState();
  }

  const lastUser = [...messages]
    .reverse()
    .find(message => message.role === 'user');
  if (lastUser && isExactQuickReply(lastUser.content)) {
    return startFlowFromIntent(detectUserIntent(lastUser.content));
  }

  if (isTicketListingThread(messages)) {
    const draft = parseTicketDraft(messages);
    return startTicketListingFlow(resolveTicketListingType(messages), draft);
  }

  if (isFindBuddyThread(messages)) {
    return startFindBuddyFlow('browse_pindan');
  }

  return createIdleState();
}

function startFlowFromIntent(intent: ReturnType<typeof detectUserIntent>): ConversationState {
  switch (intent) {
    case 'find_buddy':
      return startFindBuddyFlow('pick_activity');
    case 'sell_ticket':
      return startTicketListingFlow('sell');
    case 'buy_ticket':
      return startTicketListingFlow('buy');
    default:
      return createIdleState();
  }
}
