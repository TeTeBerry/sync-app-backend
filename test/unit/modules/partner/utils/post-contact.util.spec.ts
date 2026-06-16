import {
  matchPostContactInfo,
  matchRiskRules,
  POST_CONTACT_FORBIDDEN_MESSAGE,
} from '@src/ai/risk/risk-rules.util';

describe('matchPostContactInfo', () => {
  it('rejects structured contact label', () => {
    expect(
      matchPostContactInfo('组队，6.13-6.14，上海，2人，联系方式：13800138000'),
    ).toEqual({
      publishable: false,
      reason: POST_CONTACT_FORBIDDEN_MESSAGE,
      violationType: 'traffic_diversion',
      severity: 'high',
    });
  });

  it('rejects mobile numbers', () => {
    expect(
      matchPostContactInfo('上海出发 13800138000 组队')?.violationType,
    ).toBe('traffic_diversion');
  });

  it('rejects email addresses', () => {
    expect(matchPostContactInfo('联系 berry@example.com')?.reason).toBe(
      POST_CONTACT_FORBIDDEN_MESSAGE,
    );
  });

  it('allows normal buddy posts without contact info', () => {
    expect(
      matchPostContactInfo('组队，6.13-6.14，上海，2人，女生优先'),
    ).toBeNull();
  });
});

describe('matchRiskRules contact enforcement', () => {
  it('rejects posts with phone numbers via contact rule', () => {
    expect(matchRiskRules('组队 13800138000')?.reason).toBe(
      POST_CONTACT_FORBIDDEN_MESSAGE,
    );
  });
});
