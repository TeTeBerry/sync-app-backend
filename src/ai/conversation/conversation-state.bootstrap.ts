import { createIdleState, type ConversationState } from './conversation-state.types';

/** 旧会话无结构化状态时，从历史消息推断一次 */
export function bootstrapConversationState(
  _messages: unknown[] = [],
): ConversationState {
  return createIdleState();
}
