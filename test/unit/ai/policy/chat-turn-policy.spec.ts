import {
  isReadOnlyTurn,
  shouldRunAgentFirst,
} from '@src/ai/policy/chat-turn-policy';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('chat-turn-policy', () => {
  const baseDto = {
    sessionId: 's1',
    actor: toRequestActor('u1', 'User'),
    messages: [],
  };

  it('detects read-only turns', () => {
    expect(isReadOnlyTurn('Marshmello 是什么风格', 5)).toBe(true);
    expect(isReadOnlyTurn('风暴电音节', undefined)).toBe(true);
    expect(isReadOnlyTurn('这场几点开始', 5)).toBe(true);
    expect(isReadOnlyTurn('13号 A区 缺1人', 4)).toBe(false);
  });

  it('allows agent on homepage and read-only activity turns', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: baseDto,
        input: '帮我找类似风格的DJ',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(true);

    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 5 },
        input: '这场几点开始',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(true);
  });
});
