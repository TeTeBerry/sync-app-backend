import { matchRiskRules } from '@src/ai/risk/risk-rules.util';

describe('matchRiskRules', () => {
  it('rejects repeated-character spam', () => {
    const result = matchRiskRules('aaaaaaaaaaaaa');
    expect(result?.publishable).toBe(false);
    expect(result?.violationType).toBe('spam');
  });

  it('detects scalper keywords', () => {
    expect(matchRiskRules('黄牛加价出票，需要的私聊')?.violationType).toBe(
      'scalper',
    );
    expect(matchRiskRules('代抢门票，溢价可谈')?.violationType).toBe('scalper');
  });

  it('detects WeChat traffic diversion', () => {
    expect(matchRiskRules('加我微信 vx12345')?.violationType).toBe(
      'traffic_diversion',
    );
    expect(matchRiskRules('扫码进群，二维码在图里')?.violationType).toBe(
      'traffic_diversion',
    );
    expect(matchRiskRules('私聊引流')?.violationType).toBe('traffic_diversion');
  });

  it('detects external links', () => {
    expect(matchRiskRules('点击 https://example.com 购买')?.violationType).toBe(
      'spam',
    );
  });

  it('allows normal buddy posts', () => {
    expect(matchRiskRules('找周杰伦演唱会同行，上海出发')).toBeNull();
  });
});
