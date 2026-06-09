import {
  compareAgentShadow,
  inferExpectedAgentTools,
} from '@src/ai/agent/agent-shadow.util';

describe('agent-shadow.util', () => {
  it('expects query_dj_info for dj_info intent', () => {
    expect(
      inferExpectedAgentTools('Marshmello 是什么风格', {
        kind: 'dj_info',
        source: 'rule',
      }),
    ).toEqual(['query_dj_info']);
  });

  it('expects get_festival_info for festival shortcut', () => {
    expect(
      inferExpectedAgentTools('风暴电音节', {
        kind: 'quick_reply',
        source: 'rule',
      }),
    ).toEqual(['get_festival_info']);
  });

  it('marks shadow match when agent used expected tool', () => {
    const result = compareAgentShadow({
      input: 'Marshmello 是什么风格',
      legacyIntent: { kind: 'dj_info', source: 'rule' },
      agentToolsUsed: ['query_dj_info'],
    });
    expect(result.intentToolMatch).toBe(true);
  });

  it('expects no tools for unmatched quick_reply', () => {
    const result = compareAgentShadow({
      input: '你好',
      legacyIntent: { kind: 'quick_reply', source: 'llm' },
      agentToolsUsed: [],
    });
    expect(result.intentToolMatch).toBe(true);
  });
});
