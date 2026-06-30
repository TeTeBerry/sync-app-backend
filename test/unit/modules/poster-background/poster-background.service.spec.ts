import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { RedisMemoryJsonCacheService } from '../../../../src/infra/cache/redis-memory-json-cache.service';
import { CloudStorageService } from '../../../../src/infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../../../src/infra/cloud/cloud-storage-upload.service';
import { HunyuanImageClient } from '../../../../src/infra/llm/hunyuan-image.client';
import { PosterBackgroundService } from '../../../../src/modules/poster-background/poster-background.service';

describe('PosterBackgroundService', () => {
  const cache = {
    getJson: jest.fn(),
    setJson: jest.fn(),
  } as unknown as jest.Mocked<RedisMemoryJsonCacheService>;

  const imageClient = {
    enabled: true,
    generateImage: jest.fn(),
  } as unknown as jest.Mocked<HunyuanImageClient>;

  const cloudUpload = {
    isConfigured: jest.fn(),
    uploadBuffer: jest.fn(),
  } as unknown as jest.Mocked<CloudStorageUploadService>;

  const cloudStorage = {
    fetchCloudFileDownloadUrls: jest.fn(),
  } as unknown as jest.Mocked<CloudStorageService>;

  let service: PosterBackgroundService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosterBackgroundService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'posterBackground.cacheTtlSec') return 3600;
              return undefined;
            }),
          },
        },
        { provide: RedisMemoryJsonCacheService, useValue: cache },
        { provide: HunyuanImageClient, useValue: imageClient },
        { provide: CloudStorageUploadService, useValue: cloudUpload },
        { provide: CloudStorageService, useValue: cloudStorage },
      ],
    }).compile();

    service = module.get(PosterBackgroundService);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    }) as typeof fetch;
  });

  it('returns cached background without generating', async () => {
    cache.getJson.mockResolvedValue({
      imageUrl: 'https://cdn.example/bg.jpg',
      fileId: 'cloud://env/poster-bg/x.jpg',
    });

    const result = await service.generate(
      { kind: 'set_vote', activityLegacyId: 8, activityName: 'EDC' },
      { resolvedUserId: 'u1' } as never,
    );

    expect(result).toEqual({
      available: true,
      imageUrl: 'https://cdn.example/bg.jpg',
      source: 'cache',
    });
    expect(imageClient.generateImage).not.toHaveBeenCalled();
  });

  it('requires activityLegacyId for set_vote', async () => {
    await expect(
      service.generate({ kind: 'set_vote' }, { resolvedUserId: 'u1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires activityLegacyId for recruit_post', async () => {
    await expect(
      service.generate({ kind: 'recruit_post' }, {
        resolvedUserId: 'u1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates and caches when miss', async () => {
    cache.getJson.mockResolvedValue(null);
    imageClient.generateImage.mockResolvedValue('https://temp.example/a.jpg');
    cloudUpload.isConfigured.mockReturnValue(true);
    cloudUpload.uploadBuffer.mockResolvedValue('cloud://env/poster-bg/a.jpg');
    cloudStorage.fetchCloudFileDownloadUrls.mockResolvedValue([
      'https://cdn.example/a.jpg',
    ]);

    const result = await service.generate(
      {
        kind: 'personality_test',
        personalityType: 'rager',
      },
      { resolvedUserId: 'u1' } as never,
    );

    expect(result.source).toBe('generated');
    expect(cache.setJson).toHaveBeenCalled();
  });
});
