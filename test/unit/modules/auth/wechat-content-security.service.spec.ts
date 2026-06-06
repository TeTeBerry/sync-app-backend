import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatAccessTokenService } from '@src/modules/auth/wechat-access-token.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';

describe('WechatContentSecurityService', () => {
  const accessToken = {
    isConfigured: jest.fn(() => true),
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
    clearCache: jest.fn(),
  } as unknown as WechatAccessTokenService;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'auth.wechatMini.contentSecurityEnabled') return true;
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: WechatContentSecurityService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (accessToken.isConfigured as jest.Mock).mockReturnValue(true);
    (accessToken.getAccessToken as jest.Mock).mockResolvedValue('test-token');
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'auth.wechatMini.contentSecurityEnabled') return true;
      return undefined;
    });
    service = new WechatContentSecurityService(config, accessToken);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('skips check when content security is disabled', async () => {
    (config.get as jest.Mock).mockReturnValue(false);
    const disabled = new WechatContentSecurityService(config, accessToken);
    await disabled.assertImageSafe({
      buffer: Buffer.from('x'),
      mime: 'image/jpeg',
      size: 10,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('passes when WeChat returns errcode 0', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 0 }),
    });

    await service.assertImageSafe({
      buffer: Buffer.from('jpeg-bytes'),
      mime: 'image/jpeg',
      size: 100,
    });

    expect(accessToken.getAccessToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/wxa/img_sec_check'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(Buffer),
      }),
    );
  });

  it('rejects WebP before calling WeChat img_sec_check', async () => {
    await expect(
      service.assertImageSafe({
        buffer: Buffer.from('webp'),
        mime: 'image/webp',
        size: 4,
      }),
    ).rejects.toThrow(/WebP/);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps img_sec_check errcode 47001 to format error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 47001, errmsg: 'data format error' }),
    });

    await expect(
      service.assertImageSafe({
        buffer: Buffer.from('jpeg-bytes'),
        mime: 'image/jpeg',
        size: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects risky images with errcode 87014', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 87014, errmsg: 'risky content' }),
    });

    await expect(
      service.assertImageSafe({
        buffer: Buffer.from('bad'),
        mime: 'image/png',
        size: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects files larger than 1MB when enabled', async () => {
    await expect(
      service.assertImageSafe({
        buffer: Buffer.alloc(1024 * 1024 + 1),
        mime: 'image/jpeg',
        size: 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(/1MB/);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('passes text when msg_sec_check returns errcode 0', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 0 }),
    });

    await service.assertTextSafe('找组队拼房');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/wxa/msg_sec_check'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('rejects risky text with errcode 87014', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 87014 }),
    });

    await expect(service.assertTextSafe('违规文本')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('assertTextsSafe skips empty fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ errcode: 0 }),
    });

    await service.assertTextsSafe(['', undefined, '  ', 'ok']);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
