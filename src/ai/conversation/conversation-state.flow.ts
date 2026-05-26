import { detectUserIntent, isExactQuickReply } from '../utils/user-intent';
import {
  createIdleState,
  type ConversationState,
} from './conversation-state.types';

export function resetToIdle(): ConversationState {
  return createIdleState();
}

/** 快捷回复 / 显式换话题时切换流程 */
export function applyFlowSwitch(
  state: ConversationState,
  input: string,
): ConversationState | null {
  if (!isExactQuickReply(input)) {
    return null;
  }

  const intent = detectUserIntent(input);
  if (intent === 'near_events' || intent === 'find_buddy') {
    return resetToIdle();
  }

  return null;
}
