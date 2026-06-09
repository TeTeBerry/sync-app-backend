import {
  buildAgentContextBlock,
  buildAgentLlmMessages,
  buildAgentSystemPrompt,
} from '@src/ai/agent/agent-context.builder';

describe('agent-context.builder', () => {
  it('includes activity and history in context block', () => {
    const block = buildAgentContextBlock({
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

    expect(block).toContain('风暴电音节 深圳站');
    expect(block).toContain('Marshmello 是什么风格');
    expect(block).toContain('flow: idle');
  });

  it('mentions tools in system prompt', () => {
    const system = buildAgentSystemPrompt();
    expect(system).toContain('query_dj_info');
    expect(system).toContain('类似风格');
    expect(system).toContain('get_festival_info');
    expect(system).toContain('get_activity_brief');
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
