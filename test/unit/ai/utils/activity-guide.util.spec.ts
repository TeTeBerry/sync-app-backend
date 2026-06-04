import {
  AI_GUIDE_SHORTCUT_TEXT,
  buildActivityGuideReply,
  isActivityGuideShortcut,
  isTravelGuideIntent,
} from '@src/ai/utils/activity-guide.util';

describe('activity-guide.util', () => {
  it('recognizes AI攻略 shortcut', () => {
    expect(isActivityGuideShortcut('AI攻略')).toBe(true);
    expect(isActivityGuideShortcut('  AI攻略  ')).toBe(true);
  });

  it('recognizes natural-language travel guide intents', () => {
    expect(isTravelGuideIntent('帮我规划行程')).toBe(true);
    expect(isTravelGuideIntent('规划行程')).toBe(true);
    expect(isTravelGuideIntent('帮我生成出行攻略')).toBe(true);
    expect(isTravelGuideIntent('规划')).toBe(true);
    expect(isTravelGuideIntent('攻略')).toBe(true);
    expect(isTravelGuideIntent('组队队友')).toBe(false);
  });

  it('prompts for festival when no activity bound', () => {
    const reply = buildActivityGuideReply(null);
    expect(reply).toContain('想了解哪场电音节');
    expect(reply).toContain('你想参加哪个活动');
  });

  it('includes lineup for known festival activity', () => {
    const reply = buildActivityGuideReply({
      legacyId: 4,
      code: 'storm',
      name: '风暴电音节 深圳站',
      date: '06/13-14',
      location: '深圳国际会展中心',
    } as never);
    expect(reply).toContain('AI 攻略');
    expect(reply).toContain('MARSHMELLO');
    expect(reply).toContain('找组队');
  });
});
