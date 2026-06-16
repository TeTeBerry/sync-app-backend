import { ConfigService } from '@nestjs/config';
import { WechatAccessTokenService } from '@src/modules/auth/wechat-access-token.service';

describe('WechatAccessTokenService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('caches access_token until near expiry', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        access_token: 'cached-token',
        expires_in: 7200,
      }),
    }) as typeof fetch;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'auth.wechatMini.appId') return 'wx-app';
        if (key === 'auth.wechatMini.appSecret') return 'secret';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new WechatAccessTokenService(config);
    await expect(service.getAccessToken()).resolves.toBe('cached-token');
    await expect(service.getAccessToken()).resolves.toBe('cached-token');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/cgi-bin/stable_token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          grant_type: 'client_credential',
          appid: 'wx-app',
          secret: 'secret',
          force_refresh: false,
        }),
      }),
    );
  });
});
