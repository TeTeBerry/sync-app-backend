import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { CloudStorageService } from '../../../../src/infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../../../src/infra/cloud/cloud-storage-upload.service';
import { HunyuanImageClient } from '../../../../src/infra/llm/hunyuan-image.client';
import {
  MARKETING_AGENT_CLOUD_PREFIX,
  MarketingAiImageService,
} from '../../../../src/modules/marketing-ai/marketing-ai-image.service';
import type { InstagramAssetRequest } from '../../../../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

describe('MarketingAiImageService', () => {
  const generateImage = jest.fn();
  const fetchMock = jest.fn();
  const uploadBuffer = jest.fn();
  const fetchCloudFileDownloadUrls = jest.fn();
  let imageEnabled = true;
  let cloudConfigured = true;

  const imageClient = {
    get enabled() {
      return imageEnabled;
    },
    generateImage,
  } as unknown as jest.Mocked<
    Pick<HunyuanImageClient, 'enabled' | 'generateImage'>
  >;

  const cloudUpload = {
    isConfigured: jest.fn(() => cloudConfigured),
    uploadBuffer,
  } as unknown as jest.Mocked<CloudStorageUploadService>;

  const cloudStorage = {
    fetchCloudFileDownloadUrls,
  } as unknown as jest.Mocked<CloudStorageService>;

  let service: MarketingAiImageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    imageEnabled = true;
    cloudConfigured = true;
    (cloudUpload.isConfigured as jest.Mock).mockReturnValue(cloudConfigured);
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingAiImageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'cloudbase.envId' ? 'sync-env' : undefined,
            ),
          },
        },
        { provide: HunyuanImageClient, useValue: imageClient },
        { provide: CloudStorageUploadService, useValue: cloudUpload },
        { provide: CloudStorageService, useValue: cloudStorage },
      ],
    }).compile();

    service = module.get(MarketingAiImageService);
  });

  const baseDto: InstagramAssetRequest = {
    festival: {
      id: 'tomorrowland-thailand-2026',
      name: 'Tomorrowland Thailand',
      location: 'Pattaya',
      country: 'Thailand',
    },
    publishingPackage: {
      topic: 'Travel guide',
      caption: 'Your travel guide caption',
      hashtags: ['Tomorrowland'],
    },
    brandStyle: {
      brandName: 'Raven',
      mood: 'premium',
      background: 'dark',
      colorPalette: ['deep purple', 'electric blue', 'black'],
      typography: 'clean sans-serif',
      visualTone: ['festival travel', 'minimal'],
      avoid: ['crowded party photos'],
    },
    carousel: [
      {
        slide: 1,
        headline: 'Getting there',
        body: 'Fly into U-Tapao',
        imageDescription: 'Premium travel visual with airport and beach mood',
        overlayText: ['Getting there', 'Fly into U-Tapao'],
        aspectRatio: '4:5',
      },
      {
        slide: 2,
        headline: 'Where to stay',
        body: 'Book early near the venue',
        imageDescription: 'Minimal hotel and coastline visual',
        overlayText: ['Where to stay'],
        aspectRatio: '4:5',
      },
    ],
  };

  it('throws when image client is disabled', async () => {
    imageEnabled = false;

    await expect(service.generateInstagramAssets(baseDto)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws when cloud storage is not configured', async () => {
    cloudConfigured = false;
    (cloudUpload.isConfigured as jest.Mock).mockReturnValue(false);

    await expect(service.generateInstagramAssets(baseDto)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('uploads carousel images and returns structured paths with promptUsed', async () => {
    generateImage.mockResolvedValue('https://example.com/generated.png');
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    uploadBuffer.mockImplementation(
      async (cloudPath: string) => `cloud://sync-env/${cloudPath}`,
    );
    fetchCloudFileDownloadUrls.mockResolvedValue([
      'https://cdn.example.com/marketing-agent/slide1.png',
    ]);

    const result = await service.generateInstagramAssets(baseDto);

    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(generateImage.mock.calls[0][0].prompt).toContain(
      'Instagram carousel slide',
    );
    expect(uploadBuffer).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^${MARKETING_AGENT_CLOUD_PREFIX}generated/images/\\d{4}-\\d{2}-\\d{2}/tomorrowland-thailand-2026-slide-1\\.png$`,
        ),
      ),
      expect.any(Buffer),
    );
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toMatchObject({
      slide: 1,
      title: 'Getting there',
      imagePath: expect.stringMatching(
        /^generated\/images\/\d{4}-\d{2}-\d{2}\/tomorrowland-thailand-2026-slide-1\.png$/,
      ),
      imageUrl: 'https://cdn.example.com/marketing-agent/slide1.png',
      promptUsed: expect.stringContaining('Getting there'),
    });
  });
});
