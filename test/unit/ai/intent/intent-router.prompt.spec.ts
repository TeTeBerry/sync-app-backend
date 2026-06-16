import {
  buildIntentRouterSystemPrompt,
  buildIntentRouterUserPrompt,
  INTENT_ROUTER_FEW_SHOTS,
} from '@src/ai/intent/intent-router.prompt';

describe('intent-router.prompt', () => {
  it('includes few-shot examples with dj_info', () => {
    expect(INTENT_ROUTER_FEW_SHOTS.length).toBeGreaterThanOrEqual(6);
    const system = buildIntentRouterSystemPrompt();
    expect(system).toContain('chitchat');
    expect(system).toContain('dj_info');
    expect(system).toContain('Marshmello 是什么风格');
    expect(system).toContain('帮我找类似风格的DJ');
    expect(system).toContain('类似风格');
  });

  it('binds activity name, date and event days', () => {
    const user = buildIntentRouterUserPrompt({
      trimmed: '13号A',
      contextLines: '(无)',
      activity: {
        name: '风暴电音节 深圳站',
        date: '06/13-14',
        eventDaysLabel: '6月13日、6月14日',
      },
    });
    expect(user).toContain('风暴电音节 深圳站');
    expect(user).toContain('06/13-14');
    expect(user).toContain('6月13日、6月14日');
    expect(user).toContain('票区');
  });
});
