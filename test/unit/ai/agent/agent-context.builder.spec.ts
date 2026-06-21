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

  it('mentions bound tools in system prompt when activity is bound', () => {
    const system = buildAgentSystemPrompt(true);
    expect(system).toContain('query_dj_info');
    expect(system).toContain('get_activity_brief');
    expect(system).toContain('travel_guide_collect_slots');
    expect(system).toContain('itinerary_collect_and_generate');
    expect(system).toContain('post_start_collect');
    expect(system).not.toContain('get_festival_info');
    expect(system).not.toContain('personality_test_open');
    expect(system).not.toContain('profile_get_summary');
    expect(system).toContain('公开招募');
  });

  it('mentions get_festival_info for unbound sessions', () => {
    const system = buildAgentSystemPrompt(false);
    expect(system).toContain('get_festival_info');
    expect(system).not.toContain('get_activity_brief');
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
    expect(system).toContain('活动详情招募区搜索');
  });

  it('includes catalog lookup block when activity is unbound', () => {
    const messages = buildAgentLlmMessages({
      input: '风暴什么时候',
      messages: [],
      activity: null,
      conversationState: { version: 1, flow: 'idle' },
    });

    const system = messages[0].content ?? '';
    expect(system).toContain('【查节模式】');
    expect(system).toContain('get_festival_info');
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
