import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { ConversationState } from '../conversation';
import {
  getMissingBuddyFields,
  isFindBuddyThread,
  parseConversationContext,
} from '../conversation/conversation-context.parser';
import { buildBuddyClarifyReply } from '../conversation/buddy-clarify.util';
import { isExactQuickReply } from '../intent/user-intent';
import {
  isPublishConfirmIntent,
  isAwaitingPublishConfirmation,
} from '../publish/publish-confirm.util';

export interface StructuredReplyResult {
  text: string;
  nextState: ConversationState;
}

export function shouldHandleStructuredReply(
  _state: ConversationState,
  messages: ChatMessageDto[],
  input: string,
  activityLegacyId?: number,
): boolean {
  if (!isFindBuddyThread(messages)) return false;
  if (isExactQuickReply(input)) return false;
  if (isPublishConfirmIntent(input)) return false;
  if (isAwaitingPublishConfirmation(messages)) return false;

  const ctx = parseConversationContext(messages, input);
  const missing = getMissingBuddyFields(ctx, activityLegacyId);
  return missing.length > 0;
}

export async function buildStructuredReply(
  messages: ChatMessageDto[],
  input: string,
  state: ConversationState,
  activityLegacyId?: number,
  activityName?: string,
): Promise<StructuredReplyResult | null> {
  const ctx = parseConversationContext(messages, input);
  const missing = getMissingBuddyFields(ctx, activityLegacyId);
  if (!missing.length) return null;

  return {
    text: buildBuddyClarifyReply(missing, ctx, activityName),
    nextState: state,
  };
}
