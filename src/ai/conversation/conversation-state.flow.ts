import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isDeclineRecommendationsIntent } from '../gate/recommend-gate.util';
import { detectUserIntent, isExactQuickReply } from '../intent/user-intent';
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
  const trimmed = input.trim();

  if (state.flow === 'recommend_gate') {
    if (isDeclineRecommendationsIntent(trimmed) || isPublishConfirmIntent(trimmed)) {
      return resetToIdle();
    }
  }

  if (state.flow === 'publish_confirm' && isPublishConfirmIntent(trimmed)) {
    return resetToIdle();
  }

  if (!isExactQuickReply(trimmed)) {
    return null;
  }

  const intent = detectUserIntent(trimmed);
  if (intent === 'near_events' || intent === 'find_buddy') {
    return resetToIdle();
  }

  return null;
}
