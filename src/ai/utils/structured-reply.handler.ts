import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { ConversationState } from '../conversation';

export interface StructuredReplyResult {
  text: string;
  nextState: ConversationState;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  state: ConversationState,
): Promise<StructuredReplyResult | null> {
  return {
    text: '该结构化回复路径暂不启用。',
    nextState: state,
  };
}
