import {
  isReadOnlyTurn,
  mustForceCreatePostIntent,
  shouldBlockAgentForActivityInput,
  shouldRunAgentFirst,
} from '@src/ai/policy/chat-turn-policy';
import { toRequestActor } from '@src/common/auth/actor-query.util';

describe('chat-turn-policy', () => {
  const baseDto = {
    sessionId: 's1',
    actor: toRequestActor('u1', 'User'),
    messages: [],
  };

  it('forces create_post during collect_post_body flow', () => {
    expect(
      mustForceCreatePostIntent(
        '13号 A区',
        {
          version: 1,
          flow: 'collect_post_body',
        },
        [],
      ),
    ).toBe(true);
  });

  it('detects read-only turns', () => {
    expect(isReadOnlyTurn('Marshmello 是什么风格', 5)).toBe(true);
    expect(isReadOnlyTurn('风暴电音节', undefined)).toBe(true);
    expect(isReadOnlyTurn('这场几点开始', 5)).toBe(true);
    expect(isReadOnlyTurn('13号 A区 有人吗', 4)).toBe(false);
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

  it('blocks agent for buddy search and posting flows', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '13号 A区 有人吗',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(false);

    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '确认发布',
        conversationState: { version: 1, flow: 'publish_confirm' },
      }),
    ).toBe(false);
  });

  it('blocks agent for activity-scoped write/search heuristics', () => {
    expect(shouldBlockAgentForActivityInput('找组队', 4)).toBe(true);
    expect(shouldBlockAgentForActivityInput('Marshmello 是什么风格', 5)).toBe(
      false,
    );
  });
});
