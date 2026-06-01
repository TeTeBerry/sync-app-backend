import * as fs from 'fs';
import * as path from 'path';
import {
  CONVERSATION_STATE_VERSION,
  type ConversationFlow,
  type ConversationState,
} from '../../src/shared/chat/conversation-state.types';

const FLOWS: ConversationFlow[] = [
  'idle',
  'recommend_gate',
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
        flow: 'recommend_gate',
        gate: { activityLegacyId: 4, shownPostIds: ['p1'], empty: false },
      },
      {
        version: 1,
        flow: 'publish_confirm',
        publishDraft: { activityLegacyId: 4, draftBody: '找搭子', fromSelfPost: true },
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

  it('frontend re-exports backend contract (no local duplicate types)', () => {
    const conversationPath = path.resolve(
      __dirname,
      '../../../sync-app/src/types/conversationState.ts',
    );
    const conversationContent = fs.readFileSync(conversationPath, 'utf8');

    expect(conversationContent).toContain('@sync/chat-contracts');
    expect(conversationContent).not.toMatch(/export type ConversationFlow\s*=/);
    expect(conversationContent).not.toMatch(
      /export interface ConversationState\s*\{/,
    );

    const aiChatPath = path.resolve(
      __dirname,
      '../../../sync-app/src/types/aiChat.ts',
    );
    const aiChatContent = fs.readFileSync(aiChatPath, 'utf8');

    expect(aiChatContent).toContain('@sync/chat-contracts');
    expect(aiChatContent).not.toMatch(/export type AiChatStreamEvent\s*=/);
    expect(aiChatContent).not.toMatch(/export interface RecommendedPostCard\s*\{/);
  });
});
