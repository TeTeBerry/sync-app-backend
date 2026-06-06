import { ConfigService } from '@nestjs/config';
import { UploadService } from '@src/modules/upload/upload.service';
import { WechatAccessTokenService } from '@src/modules/auth/wechat-access-token.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import { CosStorageService } from '@src/modules/cos/cos-storage.service';
import { MediaSecurityCheckService } from '@src/modules/media-security/media-security-check.service';

describe('UploadService', () => {
  const originalFetch = global.fetch;
  const cosPublicBase =
    'https://syncapp-1304288643.cos.ap-shanghai.myqcloud.com';

  const putObject = jest.fn();
  const fetchObjectByUrl = jest.fn();
  const deleteObjectForUser = jest.fn();
  const getSignedObjectUrl = jest.fn();
  const findByImageUrl = jest.fn();
  const resolveOpenid = jest.fn();
  const createPending = jest.fn();
  const toView = jest.fn();
  const recordApproved = jest.fn();
  const expireIfNeeded = jest.fn();

  beforeEach(() => {
    putObject.mockReset();
    fetchObjectByUrl.mockReset();
    deleteObjectForUser.mockReset();
    getSignedObjectUrl.mockReset();
    findByImageUrl.mockReset();
    resolveOpenid.mockReset();
    createPending.mockReset();
    toView.mockReset();
    recordApproved.mockReset();
    expireIfNeeded.mockReset();

    putObject.mockResolvedValue(
      `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg`,
    );
    fetchObjectByUrl.mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mime: 'image/jpeg',
      size: 3,
    });
    deleteObjectForUser.mockResolvedValue(undefined);
    getSignedObjectUrl.mockResolvedValue(
      `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg?sign=1`,
    );
    findByImageUrl.mockResolvedValue(null);
    resolveOpenid.mockResolvedValue('o-test');
    createPending.mockResolvedValue({
      traceId: 'trace-1',
      imageUrl: `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg`,
      status: 'pending',
    });
    toView.mockResolvedValue({
      url: `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg`,
      status: 'pending',
      traceId: 'trace-1',
      displayUrl: `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg?sign=1`,
    });
    recordApproved.mockResolvedValue(undefined);
    expireIfNeeded.mockImplementation(async (record: unknown) => record);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function buildService(
    contentSecurityEnabled: boolean,
    imageCheckMode: 'async' | 'sync' = 'sync',
  ): UploadService {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'auth.wechatMini.contentSecurityEnabled') {
          return contentSecurityEnabled;
        }
        if (key === 'auth.wechatMini.imageCheckMode') {
          return imageCheckMode;
        }
        if (key === 'auth.wechatMini.mediaCheckScene') return 4;
        if (key === 'auth.wechatMini.mediaCheckExpireMinutes') return 35;
        if (key === 'auth.wechatMini.appId') return 'wx-test';
        if (key === 'auth.wechatMini.appSecret') return 'secret';
        if (key === 'cos.serverSecretId') return 'sid';
        if (key === 'cos.serverSecretKey') return 'skey';
        if (key === 'cos.bucket') return 'syncapp-1304288643';
        if (key === 'cos.region') return 'ap-shanghai';
        if (key === 'cos.signedUrlExpiresSeconds') return 3600;
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'cos.bucket') return 'syncapp-1304288643';
        if (key === 'cos.region') return 'ap-shanghai';
        throw new Error(`missing ${key}`);
      }),
    } as unknown as ConfigService;

    const accessToken = new WechatAccessTokenService(config);
    const contentSecurity = new WechatContentSecurityService(
      config,
      accessToken,
    );
    const cosStorage = {
      putObject,
      fetchObjectByUrl,
      deleteObjectForUser,
      getSignedObjectUrl,
    } as unknown as CosStorageService;
    const mediaChecks = {
      findByImageUrl,
      resolveOpenid,
      createPending,
      toView,
      recordApproved,
      expireIfNeeded,
    } as unknown as MediaSecurityCheckService;

    return new UploadService(contentSecurity, cosStorage, mediaChecks);
  }

  it('submits async media check after multipart upload when mode is async', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          access_token: 'token',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ errcode: 0, trace_id: 'trace-1' }),
      }) as typeof fetch;

    const service = buildService(true, 'async');
    const result = await service.saveImageFile(
      {
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: 'image/jpeg',
        size: 3,
        originalname: 'a.jpg',
      },
      'demo-user',
    );

    expect(result.status).toBe('pending');
    expect(result.url).toContain('/uploads/posts/demo-user/');
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(createPending).toHaveBeenCalled();
    expect(fetchObjectByUrl).not.toHaveBeenCalled();
  });

  it('uses sync img_sec_check when mode is sync', async () => {
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

    const service = buildService(true, 'sync');
    const cosUrl = `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg`;
    const result = await service.verifyCosUpload(cosUrl, 'demo-user');

    expect(result.status).toBe('approved');
    expect(fetchObjectByUrl).toHaveBeenCalledWith(cosUrl);
    expect(recordApproved).toHaveBeenCalled();
  });

  it('returns pending for async verify submission', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          access_token: 'token',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ errcode: 0, trace_id: 'trace-1' }),
      }) as typeof fetch;

    const service = buildService(true, 'async');
    const cosUrl = `${cosPublicBase}/uploads/posts/demo-user/1710000000000_abcd.jpg`;
    const result = await service.verifyCosUpload(cosUrl, 'demo-user');

    expect(result.status).toBe('pending');
    expect(result.traceId).toBe('trace-1');
    expect(getSignedObjectUrl).toHaveBeenCalled();
    expect(fetchObjectByUrl).not.toHaveBeenCalled();
  });
});
