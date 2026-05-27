import {
  appendTravelSafetyTip,
  buildPublishableBody,
  desensitizePrivacy,
  needsTravelSafetyTip,
  stripDesensitizationMarkers,
  TRAVEL_SAFETY_TIP,
} from '@src/ai/risk/risk-sanitize.util';

describe('risk-sanitize.util', () => {
  it('desensitizes phone and qq without visible markers', () => {
    const result = desensitizePrivacy('联系我13812345678，QQ号123456789');
    expect(result).not.toContain('13812345678');
    expect(result).not.toContain('【已脱敏】');
    expect(result).toContain('联系我');
  });

  it('desensitizes external links without visible markers', () => {
    const result = desensitizePrivacy('详情见 https://example.com/foo');
    expect(result).not.toContain('https://');
    expect(result).not.toContain('【已脱敏】');
  });

  it('strips llm desensitization placeholders', () => {
    expect(stripDesensitizationMarkers('13 号 A区 【已脱敏】')).toBe('13 号 A区');
  });

  it('detects travel safety keywords', () => {
    expect(needsTravelSafetyTip('上海拼车去深圳')).toBe(true);
    expect(needsTravelSafetyTip('13号A区有人吗')).toBe(false);
  });

  it('appends safety tip for carpool posts', () => {
    const result = appendTravelSafetyTip('上海出发，2人拼车', '上海出发，2人拼车');
    expect(result).toContain(TRAVEL_SAFETY_TIP);
  });

  it('does not duplicate safety tip', () => {
    const withTip = `正文\n\n${TRAVEL_SAFETY_TIP}`;
    expect(appendTravelSafetyTip(withTip, '拼车')).toBe(withTip);
  });

  it('builds publishable body with fallback desensitization', () => {
    const result = buildPublishableBody('电话13812345678，2人拼车');
    expect(result).not.toContain('【已脱敏】');
    expect(result).toContain(TRAVEL_SAFETY_TIP);
  });

  it('prefers llm content when provided and strips markers', () => {
    const llmContent = '上海出发2人，联系【已脱敏】';
    expect(buildPublishableBody('原始', llmContent)).toBe('上海出发2人，联系');
  });
});
