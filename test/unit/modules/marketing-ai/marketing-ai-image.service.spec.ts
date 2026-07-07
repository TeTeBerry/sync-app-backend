import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { CloudStorageService } from '../../../../src/infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../../../src/infra/cloud/cloud-storage-upload.service';
import { MarketingPosterBackgroundService } from '../../../../src/modules/marketing-ai/image-renderer/marketing-poster-background.service';
import { PosterImageRendererService } from '../../../../src/modules/marketing-ai/image-renderer/poster-image-renderer.service';
import { MarketingAiImageService } from '../../../../src/modules/marketing-ai/marketing-ai-image.service';
import type { InstagramAssetRequest } from '../../../../src/modules/marketing-ai/marketing-ai-instagram-asset.types';

describe('MarketingAiImageService', () => {
  const renderTravelGuidePoster = jest.fn();
  const buildTravelGuideRendererLabel = jest.fn();
  const resolveBackgroundDataUrl = jest.fn();
  const uploadBuffer = jest.fn();
  const fetchCloudFileDownloadUrls = jest.fn();
  let cloudConfigured = true;

  const renderer = {
    renderTravelGuidePoster,
    buildTravelGuideRendererLabel,
  } as unknown as jest.Mocked<
    Pick<
      PosterImageRendererService,
      'renderTravelGuidePoster' | 'buildTravelGuideRendererLabel'
    >
  >;

  const backgroundService = {
    resolveBackgroundDataUrl,
  } as unknown as jest.Mocked<
    Pick<MarketingPosterBackgroundService, 'resolveBackgroundDataUrl'>
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
    resolveBackgroundDataUrl.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingAiImageService,
        { provide: PosterImageRendererService, useValue: renderer },
        {
          provide: MarketingPosterBackgroundService,
          useValue: backgroundService,
        },
        { provide: CloudStorageUploadService, useValue: cloudUpload },
        { provide: CloudStorageService, useValue: cloudStorage },
      ],
    }).compile();

    service = module.get(MarketingAiImageService);
  });

  const baseDto: InstagramAssetRequest = {
    festival: {
      id: 'tomorrowland-belgium-2026',
      name: 'Tomorrowland Belgium 2026',
      venue: 'De Schorre',
      location: 'Boom',
      country: 'Belgium',
      startDate: '2026-07-17',
      endDate: '2026-07-19',
      lineupArtists: [{ name: 'Martin Garrix' }],
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
        headline: 'Tomorrowland Belgium 2026',
        body: 'Your travel + vibe guide',
        imageDescription: 'Cover',
        overlayText: ['Tomorrowland Belgium 2026'],
        aspectRatio: '1:1',
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

  it('returns a single travel guide poster image', async () => {
    renderTravelGuidePoster.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
    buildTravelGuideRendererLabel.mockReturnValue(
      'travel-guide-poster-1:1-1080x1080: Tomorrowland Belgium 2026',
    );
    uploadBuffer.mockResolvedValue(
      'cloud://sync-env.bucket/marketing-agent/generated/images/poster.png',
    );
    fetchCloudFileDownloadUrls.mockResolvedValue([
      'https://cdn.example.com/marketing-agent/poster.png',
    ]);

    const result = await service.generateInstagramAssets(baseDto);

    expect(resolveBackgroundDataUrl).toHaveBeenCalled();
    expect(renderTravelGuidePoster).toHaveBeenCalled();
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      slide: 1,
      width: 1080,
      height: 1080,
      sizeId: '1:1',
      downloadUrl: 'https://cdn.example.com/marketing-agent/poster.png',
    });
    expect(result.images[0]?.imagePath).toMatch(
      /^generated\/images\/\d{4}-\d{2}-\d{2}\/tomorrowland-belgium-poster\.png$/,
    );
  });
});
