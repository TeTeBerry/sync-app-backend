import {
  CONVERSATION_STATE_VERSION,
  type ConversationFlow,
  type ConversationState,
} from '../../src/shared/chat/conversation-state.types';

const FLOWS: ConversationFlow[] = [
  'idle',
  'publish_confirm',
  'clarify_buddy',
  'collect_post_body',
];

describe('chat conversation-state contract', () => {
  it('backend version is stable', () => {
    expect(CONVERSATION_STATE_VERSION).toBe(1);
  });

  it('accepts every documented flow shape', () => {
    const samples: ConversationState[] = [
      { version: 1, flow: 'idle' },
      {
        version: 1,
        flow: 'publish_confirm',
        publishDraft: {
          activityLegacyId: 4,
          draftBody: '组队',
          fromSelfPost: true,
        },
      },
      { version: 1, flow: 'clarify_buddy' },
      {
        version: 1,
        flow: 'collect_post_body',
        publishDraft: { activityLegacyId: 4, fromSelfPost: true },
      },
    ];

    for (const state of samples) {
      expect(FLOWS).toContain(state.flow);
      expect(state.version).toBe(CONVERSATION_STATE_VERSION);
    }
  });
});
