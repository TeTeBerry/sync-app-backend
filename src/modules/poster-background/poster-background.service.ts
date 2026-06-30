import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assertCloudStorageFileIdForEnv,
  isCloudStorageFileId,
} from '../../common/media/user-image-ref.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import { CloudStorageService } from '../../infra/cloud/cloud-storage.service';
import { CloudStorageUploadService } from '../../infra/cloud/cloud-storage-upload.service';
import { HunyuanImageClient } from '../../infra/llm/hunyuan-image.client';
import type { GeneratePosterBackgroundDto } from './dto/generate-poster-background.dto';
import {
  buildPosterBackgroundCacheKey,
  buildPosterBackgroundPrompt,
  posterBackgroundSize,
} from './poster-background.prompts';

type PosterBackgroundCacheEntry = {
  imageUrl: string;
  fileId: string;
};

@Injectable()
export class PosterBackgroundService {
  private readonly logger = new Logger(PosterBackgroundService.name);
  private readonly cacheTtlSec: number;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: RedisMemoryJsonCacheService,
    private readonly imageClient: HunyuanImageClient,
    private readonly cloudUpload: CloudStorageUploadService,
    private readonly cloudStorage: CloudStorageService,
  ) {
    this.cacheTtlSec =
      this.config.get<number>('posterBackground.cacheTtlSec') ??
      7 * 24 * 60 * 60;
  }

  isEnabled(): boolean {
    return this.imageClient.enabled;
  }

  async generate(
    input: GeneratePosterBackgroundDto,
    _actor: RequestActor,
  ): Promise<{
    available: boolean;
    imageUrl?: string;
    source?: 'cache' | 'generated';
  }> {
    this.assertInput(input);

    if (!this.isEnabled()) {
      return { available: false };
    }

    const cacheKey = buildPosterBackgroundCacheKey(input);
    const redisKey = `poster-bg:${cacheKey}`;
    const cached =
      await this.cache.getJson<PosterBackgroundCacheEntry>(redisKey);
    if (cached?.imageUrl) {
      return {
        available: true,
        imageUrl: cached.imageUrl,
        source: 'cache',
      };
    }

    const prompt = buildPosterBackgroundPrompt(input);
    const size = posterBackgroundSize(input.kind);
    const tempUrl = await this.imageClient.generateImage({ prompt, size });
    if (!tempUrl) {
      return { available: false };
    }

    const buffer = Buffer.from(await this.fetchImageBuffer(tempUrl));
    if (!buffer.length) {
      return { available: false };
    }

    if (!this.cloudUpload.isConfigured()) {
      return {
        available: true,
        imageUrl: tempUrl,
        source: 'generated',
      };
    }

    const cloudPath = `poster-bg/${cacheKey.replace(/:/g, '/')}-${Date.now()}.jpg`;
    const fileId = await this.cloudUpload.uploadBuffer(cloudPath, buffer);
    const [imageUrl] = await this.cloudStorage.fetchCloudFileDownloadUrls(
      [fileId],
      (id) => {
        if (!isCloudStorageFileId(id)) {
          throw new BadRequestException('海报背景文件无效');
        }
        assertCloudStorageFileIdForEnv(id);
      },
      '无法读取海报背景',
    );
    if (!imageUrl) {
      throw new ServiceUnavailableException('海报背景读取失败，请稍后重试');
    }

    await this.cache.setJson(
      redisKey,
      { imageUrl, fileId } satisfies PosterBackgroundCacheEntry,
      this.cacheTtlSec,
    );

    this.logger.log(`poster background generated cacheKey=${cacheKey}`);
    return {
      available: true,
      imageUrl,
      source: 'generated',
    };
  }

  private assertInput(input: GeneratePosterBackgroundDto): void {
    if (
      input.kind === 'set_vote' ||
      input.kind === 'recruit_post' ||
      input.kind === 'countdown'
    ) {
      if (!input.activityLegacyId || input.activityLegacyId <= 0) {
        throw new BadRequestException('活动信息无效');
      }
      return;
    }

    const personalityType = input.personalityType?.trim();
    if (!personalityType) {
      throw new BadRequestException('人格类型无效');
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
