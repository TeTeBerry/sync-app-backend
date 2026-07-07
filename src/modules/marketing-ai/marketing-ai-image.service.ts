import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudStorageService } from '../../infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../infra/cloud/cloud-storage-upload.service';
import type { GenerateInstagramAssetsDto } from './dto/generate-instagram-assets.dto';
import { buildTravelGuidePosterSpec } from './image-renderer/build-travel-guide-poster-spec';
import { MarketingPosterBackgroundService } from './image-renderer/marketing-poster-background.service';
import { PosterImageRendererService } from './image-renderer/poster-image-renderer.service';
import type {
  InstagramAssetsResult,
  InstagramGeneratedAssetImage,
} from './marketing-ai-instagram-asset.types';
import {
  MARKETING_AGENT_CLOUD_PREFIX,
  assertMarketingAgentCloudFileId,
} from './utils/marketing-agent-cloud-ref.util';

@Injectable()
export class MarketingAiImageService {
  private readonly logger = new Logger(MarketingAiImageService.name);

  constructor(
    private readonly renderer: PosterImageRendererService,
    private readonly backgroundService: MarketingPosterBackgroundService,
    private readonly cloudUpload: CloudStorageUploadService,
    private readonly cloudStorage: CloudStorageService,
  ) {}

  async generateInstagramAssets(
    dto: GenerateInstagramAssetsDto,
  ): Promise<InstagramAssetsResult> {
    if (!this.cloudUpload.isConfigured()) {
      throw new ServiceUnavailableException(
        'Cloud storage is not configured for marketing images',
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const festivalSlug = sanitizeFestivalSlug(dto.festival.id);

    this.logger.log(
      `Rendering Instagram travel guide poster for ${dto.festival.name}`,
    );

    const image = await this.generateTravelGuidePoster(
      dto,
      dateStr,
      festivalSlug,
    );

    return {
      images: [image],
    };
  }

  private async generateTravelGuidePoster(
    dto: GenerateInstagramAssetsDto,
    dateStr: string,
    festivalSlug: string,
  ): Promise<InstagramGeneratedAssetImage> {
    const imagePath = buildInstagramPosterImagePath(dateStr, festivalSlug);
    const cloudPath = `${MARKETING_AGENT_CLOUD_PREFIX}${imagePath}`;
    const spec = buildTravelGuidePosterSpec(dto);
    spec.backgroundImageDataUrl =
      await this.backgroundService.resolveBackgroundDataUrl(
        dto.festival.name,
        spec.size,
      );
    const promptUsed = this.renderer.buildTravelGuideRendererLabel(spec);
    const outputBuffer = await this.renderer.renderTravelGuidePoster(spec);

    if (!outputBuffer.length) {
      throw new ServiceUnavailableException(
        'Failed to render Instagram poster',
      );
    }

    const fileId = await this.cloudUpload.uploadBuffer(cloudPath, outputBuffer);
    const downloadUrl = await this.resolveDownloadUrl(fileId);

    return {
      slide: 1,
      title: spec.title,
      imagePath,
      promptUsed,
      width: spec.size.width,
      height: spec.size.height,
      sizeId: spec.size.id,
      downloadUrl,
    };
  }

  private async resolveDownloadUrl(
    fileId: string,
  ): Promise<string | undefined> {
    try {
      const [downloadUrl] = await this.cloudStorage.fetchCloudFileDownloadUrls(
        [fileId],
        assertMarketingAgentCloudFileId,
        '无法读取营销图片',
      );

      return downloadUrl?.trim() || undefined;
    } catch (error) {
      this.logger.warn(
        `Marketing poster download URL unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }
}

function sanitizeFestivalSlug(festivalId: string): string {
  return festivalId
    .trim()
    .toLowerCase()
    .replace(/-\d{4}$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildInstagramPosterImagePath(
  dateStr: string,
  festivalSlug: string,
): string {
  return `generated/images/${dateStr}/${festivalSlug}-poster.png`;
}
