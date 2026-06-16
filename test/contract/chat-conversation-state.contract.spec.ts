import {
  CONVERSATION_STATE_VERSION,
  type ConversationFlow,
  type ConversationState,
} from '../../src/shared/chat/conversation-state.types';

const FLOWS: ConversationFlow[] = ['idle'];

describe('chat conversation-state contract', () => {
  it('backend version is stable', () => {
    expect(CONVERSATION_STATE_VERSION).toBe(1);
  });

  it('accepts every documented flow shape', () => {
    const samples: ConversationState[] = [{ version: 1, flow: 'idle' }];

    for (const state of samples) {
      expect(FLOWS).toContain(state.flow);
      expect(state.version).toBe(CONVERSATION_STATE_VERSION);
    }
  });
});
