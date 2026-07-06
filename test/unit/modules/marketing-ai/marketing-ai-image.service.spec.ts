import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { CloudStorageService } from '../../../../src/infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../../../src/infra/cloud/cloud-storage-upload.service';
import { PosterFestivalCoverService } from '../../../../src/modules/marketing-ai/image-renderer/poster-festival-cover.service';
import { PosterImageRendererService } from '../../../../src/modules/marketing-ai/image-renderer/poster-image-renderer.service';
import { MarketingAiImageService } from '../../../../src/modules/marketing-ai/marketing-ai-image.service';
import type { InstagramAssetRequest } from '../../../../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

describe('MarketingAiImageService', () => {
  const renderPoster = jest.fn();
  const buildRendererLabel = jest.fn();
  const resolveCoverDataUrl = jest.fn();
  const uploadBuffer = jest.fn();
  const fetchCloudFileDownloadUrls = jest.fn();
  let cloudConfigured = true;

  const renderer = {
    renderPoster,
    buildRendererLabel,
  } as unknown as jest.Mocked<
    Pick<PosterImageRendererService, 'renderPoster' | 'buildRendererLabel'>
  >;

  const coverService = {
    resolveCoverDataUrl,
  } as unknown as jest.Mocked<
    Pick<PosterFestivalCoverService, 'resolveCoverDataUrl'>
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
    cloudConfigured = true;
    (cloudUpload.isConfigured as jest.Mock).mockReturnValue(cloudConfigured);
    resolveCoverDataUrl.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingAiImageService,
        { provide: PosterImageRendererService, useValue: renderer },
        { provide: PosterFestivalCoverService, useValue: coverService },
        { provide: CloudStorageUploadService, useValue: cloudUpload },
        { provide: CloudStorageService, useValue: cloudStorage },
      ],
    }).compile();

    service = module.get(MarketingAiImageService);
  });

  const baseDto: InstagramAssetRequest = {
    festival: {
      id: 'tomorrowland-thailand-2026',
      name: 'Tomorrowland Thailand 2026',
      location: 'Pattaya',
      country: 'Thailand',
    },
    publishingPackage: {
      topic: 'Travel guide',
      caption: 'Save this before you fly.',
      hashtags: ['Tomorrowland'],
    },
    brandStyle: {
      brandName: 'Raven',
      mood: 'premium',
      background: 'dark',
      colorPalette: ['#8b7cf8', '#6e66e8', '#08080c'],
      typography: 'clean sans-serif',
      visualTone: ['festival travel', 'minimal'],
      avoid: ['crowded party photos'],
    },
    carousel: [
      {
        slide: 1,
        headline: 'Tomorrowland Thailand 2026',
        body: 'Your travel + vibe guide',
        imageDescription: 'Cover',
        overlayText: ['Tomorrowland Thailand 2026'],
        aspectRatio: '4:5',
      },
      {
        slide: 2,
        headline: 'Getting there',
        body: 'Fly into U-Tapao',
        imageDescription: 'Travel tip',
        overlayText: ['Getting there'],
        aspectRatio: '4:5',
      },
    ],
  };

  it('throws when cloud storage is not configured', async () => {
    cloudConfigured = false;
    (cloudUpload.isConfigured as jest.Mock).mockReturnValue(false);

    await expect(service.generateInstagramAssets(baseDto)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('returns a single consolidated poster image', async () => {
    renderPoster.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
    buildRendererLabel.mockReturnValue(
      'poster-sync-web-4:5-1080x1350: Tomorrowland Thailand 2026',
    );
    uploadBuffer.mockResolvedValue(
      'cloud://sync-env.bucket/marketing-agent/generated/images/poster.png',
    );
    fetchCloudFileDownloadUrls.mockResolvedValue([
      'https://cdn.example.com/marketing-agent/poster.png',
    ]);

    const result = await service.generateInstagramAssets(baseDto);

    expect(resolveCoverDataUrl).toHaveBeenCalledWith(baseDto.festival);
    expect(renderPoster).toHaveBeenCalledTimes(1);
    expect(fetchCloudFileDownloadUrls).toHaveBeenCalledTimes(1);
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      slide: 1,
      title: 'Tomorrowland Thailand 2026',
      imagePath: expect.stringMatching(
        /^generated\/images\/\d{4}-\d{2}-\d{2}\/tomorrowland-thailand-poster\.png$/,
      ),
      promptUsed: 'poster-sync-web-4:5-1080x1350: Tomorrowland Thailand 2026',
      width: 1080,
      height: 1350,
      sizeId: '4:5',
      downloadUrl: 'https://cdn.example.com/marketing-agent/poster.png',
    });
  });
});
