import { applyFlowSwitch } from './conversation-state.flow';
import type { ConversationState } from './conversation-state.types';

export { applyFlowSwitch, resetToIdle } from './conversation-state.flow';

/** 每条用户消息进入 deterministic 链之前调用 */
export async function advanceConversationState(
  state: ConversationState,
  _messages: unknown[],
  input: string,
): Promise<ConversationState> {
  return applyFlowSwitch(state, input) ?? state;
}
