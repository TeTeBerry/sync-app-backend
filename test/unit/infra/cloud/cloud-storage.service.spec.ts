import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CloudStorageService } from '@src/infra/cloud/cloud-storage.service';
import { WechatAccessTokenService } from '@src/modules/auth/wechat-access-token.service';
import * as imageRefUtil from '@src/ai/utils/image-ref.util';

jest.mock('@src/ai/utils/image-ref.util', () => ({
  fetchRemoteImageAsDataUrl: jest.fn(),
}));

describe('CloudStorageService', () => {
  const fetchRemoteImageAsDataUrl = jest.mocked(
    imageRefUtil.fetchRemoteImageAsDataUrl,
  );

  const fileId =
    'cloud://sync-prd-d7gquj4qk86da9bb2.7373-sync-prd/ugc/posts/user-1/shot.jpg';

  const accessToken = {
    isConfigured: jest.fn(() => true),
    getAccessToken: jest.fn(async () => 'wx-token'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLOUDBASE_ENV_ID = 'sync-prd-d7gquj4qk86da9bb2';
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        file_list: [
          {
            fileid: fileId,
            download_url: 'https://cdn.example/ugc/shot.jpg',
            status: 0,
          },
        ],
      }),
    })) as unknown as typeof fetch;
    fetchRemoteImageAsDataUrl.mockResolvedValue('data:image/jpeg;base64,abc');
  });

  afterEach(() => {
    delete process.env.CLOUDBASE_ENV_ID;
  });

  it('fetches cloud fileID as data URL', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CloudStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'cloudbase.envId' ? 'sync-prd-d7gquj4qk86da9bb2' : '',
          },
        },
        { provide: WechatAccessTokenService, useValue: accessToken },
      ],
    }).compile();

    const service = moduleRef.get(CloudStorageService);
    const dataUrl = await service.fetchUgcImageAsDataUrl(fileId);

    expect(accessToken.getAccessToken).toHaveBeenCalled();
    expect(fetchRemoteImageAsDataUrl).toHaveBeenCalledWith(
      'https://cdn.example/ugc/shot.jpg',
    );
    expect(dataUrl).toBe('data:image/jpeg;base64,abc');
  });

  it('rejects invalid fileID', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CloudStorageService,
        {
          provide: ConfigService,
          useValue: { get: () => 'sync-prd-d7gquj4qk86da9bb2' },
        },
        { provide: WechatAccessTokenService, useValue: accessToken },
      ],
    }).compile();

    const service = moduleRef.get(CloudStorageService);
    await expect(
      service.fetchUgcImageAsDataUrl('https://evil.example/x.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
