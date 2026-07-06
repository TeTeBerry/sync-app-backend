import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudStorageService } from '../../infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../infra/cloud/cloud-storage-upload.service';
import { HunyuanImageClient } from '../../infra/llm/hunyuan-image.client';
import type { GenerateInstagramAssetsDto } from './dto/generate-instagram-assets.dto';
import {
  INSTAGRAM_CAROUSEL_IMAGE_SIZE,
  buildInstagramCarouselImagePrompt,
} from './image-prompts/instagram-carousel.prompt';
import type {
  InstagramAssetsResult,
  InstagramGeneratedAssetImage,
} from './marketing-ai-instagram-asset.types';

export const MARKETING_AGENT_CLOUD_PREFIX = 'marketing-agent/';

@Injectable()
export class MarketingAiImageService {
  private readonly logger = new Logger(MarketingAiImageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly imageClient: HunyuanImageClient,
    private readonly cloudUpload: CloudStorageUploadService,
    private readonly cloudStorage: CloudStorageService,
  ) {}

  async generateInstagramAssets(
    dto: GenerateInstagramAssetsDto,
  ): Promise<InstagramAssetsResult> {
    if (!this.imageClient.enabled) {
      throw new ServiceUnavailableException(
        'IMAGE_GENERATION_MODEL image generation is not configured',
      );
    }

    if (!this.cloudUpload.isConfigured()) {
      throw new ServiceUnavailableException(
        'Cloud storage is not configured for marketing images',
      );
    }

    const slides = dto.carousel
      .slice(0, 5)
      .filter(
        (slide) =>
          Number.isFinite(Number(slide.slide)) && Number(slide.slide) >= 1,
      );
    if (slides.length === 0) {
      throw new ServiceUnavailableException(
        'Carousel must include at least one slide',
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const festivalSlug = sanitizeFestivalSlug(dto.festival.id);

    this.logger.log(
      `Generating ${slides.length} Instagram carousel image(s) in parallel for ${dto.festival.name}`,
    );

    const images = await Promise.all(
      slides.map((slide) =>
        this.generateSingleSlide(dto, slide, dateStr, festivalSlug),
      ),
    );

    return {
      images: images.sort((a, b) => a.slide - b.slide),
    };
  }

  private async generateSingleSlide(
    dto: GenerateInstagramAssetsDto,
    slide: GenerateInstagramAssetsDto['carousel'][number],
    dateStr: string,
    festivalSlug: string,
  ): Promise<InstagramGeneratedAssetImage> {
    const slideNumber = Number(slide.slide);
    const imagePath = buildInstagramAssetImagePath(
      dateStr,
      festivalSlug,
      slideNumber,
    );
    const cloudPath = `${MARKETING_AGENT_CLOUD_PREFIX}${imagePath}`;
    const promptUsed = buildInstagramCarouselImagePrompt(dto, slide);

    const tempUrl = await this.imageClient.generateImage({
      prompt: promptUsed,
      size: INSTAGRAM_CAROUSEL_IMAGE_SIZE,
    });

    if (!tempUrl) {
      this.logger.warn(
        `Instagram slide ${slideNumber} image generation returned empty url`,
      );
      throw new ServiceUnavailableException(
        `Failed to generate image for slide ${slideNumber}`,
      );
    }

    const buffer = Buffer.from(await this.fetchImageBuffer(tempUrl));
    if (!buffer.length) {
      throw new ServiceUnavailableException(
        `Failed to download generated image for slide ${slideNumber}`,
      );
    }

    const fileId = await this.cloudUpload.uploadBuffer(cloudPath, buffer);
    const [downloadUrl] = await this.cloudStorage.fetchCloudFileDownloadUrls(
      [fileId],
      (id) => this.assertMarketingAgentCloudFileId(id),
      '无法读取营销图片',
    );

    if (!downloadUrl) {
      throw new ServiceUnavailableException(
        `Failed to resolve cloud URL for slide ${slideNumber}`,
      );
    }

    return {
      slide: slideNumber,
      title: slide.headline.trim(),
      imagePath,
      imageUrl: downloadUrl,
      promptUsed,
    };
  }

  private assertMarketingAgentCloudFileId(fileId: string): void {
    const trimmed = fileId.trim();
    if (!/^cloud:\/\/[^/]+\/.+/.test(trimmed)) {
      throw new BadRequestException('营销图片文件无效');
    }

    const withoutScheme = trimmed.slice('cloud://'.length);
    const slash = withoutScheme.indexOf('/');
    if (slash <= 0) {
      throw new BadRequestException('营销图片文件无效');
    }

    const objectPath = withoutScheme.slice(slash + 1);
    if (
      !objectPath.startsWith(MARKETING_AGENT_CLOUD_PREFIX) ||
      objectPath.includes('..')
    ) {
      throw new BadRequestException('营销图片文件无效');
    }

    const expectedEnv =
      this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    if (!expectedEnv) {
      return;
    }

    const envSegment = withoutScheme.slice(0, slash);
    if (!envSegment.startsWith(expectedEnv)) {
      throw new BadRequestException('营销图片文件无效');
    }
  }

  private async fetchImageBuffer(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException('下载生成图片失败');
    }
    return response.arrayBuffer();
  }
}

export function sanitizeFestivalSlug(festivalId: string): string {
  return festivalId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildInstagramAssetImagePath(
  dateStr: string,
  festivalSlug: string,
  slideNumber: number,
): string {
  return `generated/images/${dateStr}/${festivalSlug}-slide-${slideNumber}.png`;
}
