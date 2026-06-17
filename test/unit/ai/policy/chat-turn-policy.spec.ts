import {
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

  it('blocks agent for buddy post entry shortcuts', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '组队发帖',
        conversationState: { version: 1, flow: 'idle' },
      }),
    ).toBe(false);
  });

  it('blocks agent during publish_confirm flow', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '确认发布',
        conversationState: { version: 1, flow: 'publish_confirm' },
      }),
    ).toBe(false);
  });

  it('blocks agent for ticket resale input', () => {
    expect(shouldBlockAgentForActivityInput('折价出一张 VIP 舞台票', 4)).toBe(
      true,
    );
    expect(shouldBlockAgentForActivityInput('Marshmello 是什么风格', 5)).toBe(
      false,
    );
  });

  it('allows agent during travel guide activeTask collection', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '舒适',
        conversationState: {
          version: 1,
          flow: 'idle',
          activeTask: {
            kind: 'travel_guide',
            travelGuide: { departure: '上海', headcount: 2 },
          },
        },
      }),
    ).toBe(true);
  });

  it('blocks agent for posting and activity-enter routed turns', () => {
    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: 'Marshmello 是什么风格',
        conversationState: { version: 1, flow: 'idle' },
        routedKind: 'activity_enter',
      }),
    ).toBe(false);

    expect(
      shouldRunAgentFirst({
        agentEnabled: true,
        dto: { ...baseDto, activityLegacyId: 4 },
        input: '随便聊聊',
        conversationState: { version: 1, flow: 'idle' },
        routedKind: 'quick_reply',
      }),
    ).toBe(true);
  });
});
