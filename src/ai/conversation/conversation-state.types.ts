export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow = 'idle';

/** 会话级结构化状态（持久化到 MongoDB） */
export interface ConversationState {
  version: number;
  flow: ConversationFlow;
}

export function createIdleState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
  };
}
