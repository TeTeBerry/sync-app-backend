import {
  buildAgentLlmMessages,
  buildAgentSystemPrompt,
} from '@src/ai/agent/agent-context.builder';

describe('agent-context.builder', () => {
  it('includes activity and history in llm messages', () => {
    const messages = buildAgentLlmMessages({
      input: 'Marshmello 是什么风格',
      messages: [{ role: 'user', content: '你好' }],
      activity: {
        legacyId: 4,
        name: '风暴电音节 深圳站',
        date: '06/13-14',
        location: '深圳国际会展中心',
      } as never,
      conversationState: { version: 1, flow: 'idle' },
    });

    const system = messages[0].content ?? '';
    expect(system).toContain('风暴电音节 深圳站');
    expect(system).toContain('flow: idle');
    expect(messages).toEqual(
      expect.arrayContaining([
        { role: 'user', content: '你好' },
        { role: 'user', content: 'Marshmello 是什么风格' },
      ]),
    );
  });

  it('mentions main-path tools in system prompt', () => {
    const system = buildAgentSystemPrompt();
    expect(system).toContain('query_dj_info');
    expect(system).toContain('get_activity_brief');
    expect(system).toContain('travel_guide_collect_slots');
    expect(system).toContain('itinerary_collect_and_generate');
    expect(system).toContain('post_start_collect');
    expect(system).not.toContain('get_festival_info');
    expect(system).not.toContain('personality_test_open');
    expect(system).not.toContain('profile_get_summary');
    expect(system).toContain('本场计划');
  });

  it('includes prep mode block when activity is bound', () => {
    const messages = buildAgentLlmMessages({
      input: '你好',
      messages: [],
      activity: {
        legacyId: 4,
        name: '风暴电音节 深圳站',
      } as never,
      conversationState: { version: 1, flow: 'idle' },
    });

    const system = messages[0].content ?? '';
    expect(system).toContain('【准备台模式】');
    expect(system).toContain('勿主动推荐人格测试');
  });

  it('builds native multi-turn llm messages', () => {
    const messages = buildAgentLlmMessages({
      input: '帮我找类似风格的DJ',
      messages: [
        { role: 'user', content: 'Marshmello 什么风格' },
        { role: 'assistant', content: 'Future Bass 制作人' },
      ],
      activity: null,
      conversationState: { version: 1, flow: 'idle' },
    });

    expect(messages[0].role).toBe('system');
    expect(messages).toEqual(
      expect.arrayContaining([
        { role: 'user', content: 'Marshmello 什么风格' },
        { role: 'assistant', content: 'Future Bass 制作人' },
        { role: 'user', content: '帮我找类似风格的DJ' },
      ]),
    );
  });
});
