import { shouldEmitPrepGuidance } from '@src/ai/orchestration/handlers/prep-guidance.util';
import { createIdleState } from '@sync/chat-contracts/conversation-state.types';

describe('shouldEmitPrepGuidance', () => {
  const idleState = createIdleState();

  it('returns true for plain agent reply with no tools or richer events', () => {
    expect(
      shouldEmitPrepGuidance({
        toolsUsed: [],
        conversationState: idleState,
        events: [{ type: 'delta', content: 'Techno 是一种电子音乐风格…' }],
      }),
    ).toBe(true);
  });

  it('returns false when tools were used', () => {
    expect(
      shouldEmitPrepGuidance({
        toolsUsed: ['query_dj_info'],
        conversationState: idleState,
        events: [{ type: 'delta', content: 'reply' }],
      }),
    ).toBe(false);
  });

  it('returns false when activeTask is set', () => {
    expect(
      shouldEmitPrepGuidance({
        toolsUsed: [],
        conversationState: {
          ...idleState,
          activeTask: {
            kind: 'travel_guide',
            travelGuide: { departure: '上海' },
          },
        },
        events: [{ type: 'delta', content: 'reply' }],
      }),
    ).toBe(false);
  });

  it('returns false during collect_post_body flow', () => {
    expect(
      shouldEmitPrepGuidance({
        toolsUsed: [],
        conversationState: { ...idleState, flow: 'collect_post_body' },
        events: [{ type: 'delta', content: 'reply' }],
      }),
    ).toBe(false);
  });

  it('returns false when suggested_replies already present', () => {
    expect(
      shouldEmitPrepGuidance({
        toolsUsed: [],
        conversationState: idleState,
        events: [
          { type: 'delta', content: 'reply' },
          { type: 'suggested_replies', replies: ['查阵容'] },
        ],
      }),
    ).toBe(false);
  });

  it('returns false when client_action already present', () => {
    expect(
      shouldEmitPrepGuidance({
        toolsUsed: [],
        conversationState: idleState,
        events: [
          { type: 'delta', content: 'reply' },
          {
            type: 'client_action',
            action: { kind: 'open_sheet', sheet: 'travel_guide' },
          },
        ],
      }),
    ).toBe(false);
  });
});
