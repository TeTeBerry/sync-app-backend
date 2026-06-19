import {
  assertCommentHasNoContactInfo,
  assertPostHasNoContactInfo,
} from '@src/modules/partner/utils/post-contact.util';
import {
  COMMENT_CONTACT_FORBIDDEN_MESSAGE,
  matchPostContactInfo,
  matchCommentContactInfo,
  matchRiskRules,
  POST_CONTACT_FORBIDDEN_MESSAGE,
} from '@src/ai/risk/risk-rules.util';
import { BadRequestException } from '@nestjs/common';

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

describe('assertCommentHasNoContactInfo', () => {
  it('throws comment-specific message for phone numbers', () => {
    expect(() => assertCommentHasNoContactInfo('联系 13800138000')).toThrow(
      new BadRequestException(COMMENT_CONTACT_FORBIDDEN_MESSAGE),
    );
  });

  it('throws comment-specific message for wechat diversion', () => {
    expect(() => assertCommentHasNoContactInfo('加我微信 vx12345')).toThrow(
      new BadRequestException(COMMENT_CONTACT_FORBIDDEN_MESSAGE),
    );
  });

  it('allows normal comments', () => {
    expect(() =>
      assertCommentHasNoContactInfo('同场可以一起逛展吗'),
    ).not.toThrow();
  });
});

describe('matchCommentContactInfo', () => {
  it('covers diversion phrases not matched by post contact only', () => {
    expect(matchCommentContactInfo('加我微信私聊')?.reason).toBe(
      COMMENT_CONTACT_FORBIDDEN_MESSAGE,
    );
  });
});

describe('assertPostHasNoContactInfo', () => {
  it('throws post-specific message for contact info', () => {
    expect(() => assertPostHasNoContactInfo('联系 13800138000')).toThrow(
      new BadRequestException(POST_CONTACT_FORBIDDEN_MESSAGE),
    );
  });
});
