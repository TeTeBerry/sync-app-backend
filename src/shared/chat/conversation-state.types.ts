export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow = 'idle';

/** Session-level structured state (persisted to MongoDB). */
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
