import { ChatMessageDto } from '../presentation/chat-message.dto';
import { PUBLISH_CONFIRM_PROMPT_MARKER } from '../publish/publish-confirm.util';
import { RECOMMEND_GATE_MARKER } from '../gate/recommend-gate.util';
import {
  createIdleState,
  enterPublishConfirmState,
  enterRecommendGateState,
  type ConversationState,
} from './conversation-state.types';

function findLastAssistantMessage(
  messages: ChatMessageDto[],
): ChatMessageDto | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return messages[index];
    }
  }
  return undefined;
}

/** 旧会话无结构化状态时，从历史消息推断一次 */
export function bootstrapConversationState(
  messages: ChatMessageDto[] = [],
): ConversationState {
  const lastAssistant = findLastAssistantMessage(messages);
  if (!lastAssistant?.content) {
    return createIdleState();
  }

  if (lastAssistant.content.includes(RECOMMEND_GATE_MARKER)) {
    return enterRecommendGateState({});
  }

  if (lastAssistant.content.includes(PUBLISH_CONFIRM_PROMPT_MARKER)) {
    return enterPublishConfirmState({});
  }

  return createIdleState();
}
