import { shouldRunAgentFirst } from '@src/ai/agent/agent-first.util';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('agent-first.util', () => {
  const baseDto = {
    sessionId: 's1',
    actor: toRequestActor('u1', 'User'),
    messages: [],
  };

  it('allows agent on homepage chat', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: baseDto,
        input: '帮我找类似风格的DJ',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(true);
  });

  it('blocks agent during publish confirm flow', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '确认发布',
        conversationState: { version: 1, flow: 'publish_confirm' },
      }),
    ).toBe(false);
  });

  it('blocks agent for activity buddy search', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '13号 A区 有人吗',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(false);
  });

  it('allows agent for home festival shortcut', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: baseDto,
        input: '风暴电音节',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(true);
  });

  it('allows agent for activity brief on bound activity', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 5 },
        input: '这场几点开始',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(true);
  });

  it('allows agent for DJ query on bound activity even with find-buddy heuristics nearby', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '帮我找类似风格的DJ',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(true);
  });
});
