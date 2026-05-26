import {
  appendTravelSafetyTip,
  buildPublishableBody,
  desensitizePrivacy,
  needsTravelSafetyTip,
  TRAVEL_SAFETY_TIP,
} from './risk-sanitize.util';

describe('risk-sanitize.util', () => {
  it('desensitizes phone and qq', () => {
    const result = desensitizePrivacy('联系我13812345678，QQ号123456789');
    expect(result).not.toContain('13812345678');
    expect(result).toContain('【已脱敏】');
  });

  it('desensitizes external links', () => {
    const result = desensitizePrivacy('详情见 https://example.com/foo');
    expect(result).toContain('【已脱敏】');
    expect(result).not.toContain('https://');
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
    expect(result).toContain('【已脱敏】');
    expect(result).toContain(TRAVEL_SAFETY_TIP);
  });

  it('prefers llm content when provided', () => {
    const llmContent = '上海出发2人，联系【已脱敏】';
    expect(buildPublishableBody('原始', llmContent)).toBe(llmContent);
  });
});
