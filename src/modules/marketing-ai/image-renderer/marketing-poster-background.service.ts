import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchRemoteImageAsDataUrl } from '../../../ai/utils/image-ref.util';
import { HunyuanImageClient } from '../../../infra/llm/hunyuan-image.client';
import type { PosterSizePreset } from './poster-size.presets';

const MARKETING_POSTER_BACKGROUND_STYLE =
  'Abstract premium festival travel wallpaper, smooth purple and violet gradient glow, soft neon stage lights, dreamy atmosphere, no text, no people faces, no logos, clean negative space in center for overlay card, high quality illustration';

@Injectable()
export class MarketingPosterBackgroundService {
  private readonly logger = new Logger(MarketingPosterBackgroundService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly imageClient: HunyuanImageClient,
  ) {}

  isEnabled(): boolean {
    return this.imageClient.enabled;
  }

  async resolveBackgroundDataUrl(
    festivalName: string,
    size: PosterSizePreset,
  ): Promise<string | undefined> {
    if (!this.isEnabled()) {
      this.logger.warn(
        'Hunyuan image generation disabled — using gradient fallback',
      );
      return undefined;
    }

    const prompt =
      `${MARKETING_POSTER_BACKGROUND_STYLE}, inspired by ${festivalName.trim()}`.slice(
        0,
        500,
      );
    const imageSize = this.resolveImageSize(size);

    const tempUrl = await this.imageClient.generateImage({
      prompt,
      size: imageSize,
    });
    if (!tempUrl) {
      return undefined;
    }

    try {
      return await fetchRemoteImageAsDataUrl(tempUrl);
    } catch (error) {
      this.logger.warn(
        `Marketing poster background fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  private resolveImageSize(size: PosterSizePreset): string {
    const configured =
      this.config.get<string>('imageGeneration.marketingPosterSize')?.trim() ??
      '';
    if (configured) {
      return configured;
    }

    return `${size.width}x${size.height}`;
  }
}
