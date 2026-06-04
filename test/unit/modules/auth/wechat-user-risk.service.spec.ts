import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatUserRiskService } from '@src/modules/auth/wechat-user-risk.service';
import { WechatAccessTokenService } from '@src/modules/auth/wechat-access-token.service';

describe('WechatUserRiskService', () => {
  const accessToken = {
    isConfigured: jest.fn(() => true),
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
  } as unknown as WechatAccessTokenService;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'auth.wechatMini.userRiskEnabled') return true;
      if (key === 'auth.wechatMini.userRiskMaxRank') return 2;
      if (key === 'auth.wechatMini.userRiskRecheckHours') return 24;
      if (key === 'auth.wechatMini.appId') return 'wx-test-app';
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: WechatUserRiskService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WechatUserRiskService(config, accessToken);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('allows rank within max', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 0, risk_rank: 1 }),
    });

    const rank = await service.fetchAndAssertRiskRank({
      openid: 'o-test',
      clientIp: '1.2.3.4',
    });

    expect(rank).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/wxa/getuserriskrank'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('blocks rank above max', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 0, risk_rank: 4 }),
    });

    await expect(
      service.fetchAndAssertRiskRank({
        openid: 'o-test',
        clientIp: '1.2.3.4',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
