import {
  buildIntentRouterSystemPrompt,
  buildIntentRouterUserPrompt,
  INTENT_ROUTER_FEW_SHOTS,
} from './intent-router.prompt';

describe('intent-router.prompt', () => {
  it('includes 10 few-shot examples', () => {
    expect(INTENT_ROUTER_FEW_SHOTS).toHaveLength(10);
    const system = buildIntentRouterSystemPrompt();
    expect(system).toContain('13号 A区 有人吗');
    expect(system).toContain('search_posts');
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
