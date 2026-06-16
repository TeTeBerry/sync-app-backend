import { detectUserIntent, isExactQuickReply } from '../intent/user-intent';
import {
  createIdleState,
  type ConversationState,
} from '../../shared/chat/conversation-state.types';

export function resetToIdle(): ConversationState {
  return createIdleState();
}

/** 快捷回复 / 显式换话题时切换流程 */
export function applyFlowSwitch(
  state: ConversationState,
  input: string,
): ConversationState | null {
  const trimmed = input.trim();

  if (!isExactQuickReply(trimmed)) {
    return null;
  }

  const intent = detectUserIntent(trimmed);
  if (intent === 'near_events') {
    return resetToIdle();
  }

  return null;
}
