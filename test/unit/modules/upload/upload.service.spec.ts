import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { UploadService } from '@src/modules/upload/upload.service';
import { WechatAccessTokenService } from '@src/modules/auth/wechat-access-token.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';

describe('UploadService', () => {
  const uploadDir = join(process.cwd(), 'uploads-test-tmp');
  const originalFetch = global.fetch;

  beforeAll(() => {
    mkdirSync(uploadDir, { recursive: true });
    process.env.UPLOAD_DIR = uploadDir;
    process.env.UPLOAD_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
  });

  afterAll(() => {
    if (existsSync(uploadDir)) {
      rmSync(uploadDir, { recursive: true, force: true });
    }
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_PUBLIC_BASE_URL;
    global.fetch = originalFetch;
  });

  function buildService(contentSecurityEnabled: boolean): UploadService {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'auth.wechatMini.contentSecurityEnabled') {
          return contentSecurityEnabled;
        }
        if (key === 'auth.wechatMini.appId') return 'wx-test';
        if (key === 'auth.wechatMini.appSecret') return 'secret';
        return undefined;
      }),
    } as unknown as ConfigService;

    const accessToken = new WechatAccessTokenService(config);
    const contentSecurity = new WechatContentSecurityService(
      config,
      accessToken,
    );
    return new UploadService(contentSecurity);
  }

  it('saves image when WeChat img_sec_check passes', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          access_token: 'token',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ errcode: 0 }),
      }) as typeof fetch;

    const service = buildService(true);
    const { url } = await service.saveImageFile({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: 'image/jpeg',
      size: 3,
      originalname: 'a.jpg',
    });

    expect(url).toMatch(/\/uploads\/\d+-[\w]+\.jpg$/);
    const filename = url.split('/uploads/')[1];
    expect(readFileSync(join(uploadDir, filename)).length).toBe(3);
  });

  it('does not save file when WeChat rejects image', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          access_token: 'token',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ errcode: 87014 }),
      }) as typeof fetch;

    const service = buildService(true);
    const before = existsSync(uploadDir)
      ? require('fs').readdirSync(uploadDir).length
      : 0;

    await expect(
      service.saveImageFile({
        buffer: Buffer.from('bad'),
        mimetype: 'image/jpeg',
        size: 3,
      }),
    ).rejects.toThrow(/违规/);

    const after = require('fs').readdirSync(uploadDir).length;
    expect(after).toBe(before);
  });
});
