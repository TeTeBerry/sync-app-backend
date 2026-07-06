import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const HY_IMAGE_PLUS_MODEL = 'HY-Image-3.0-Plus-4090-Tob-v1.0';

/**
 * CloudBase SDK image API provider (fixed route name, not the generation model).
 * @see https://docs.cloudbase.net/ai/image-model/wx-server-sdk
 */
const CLOUDBASE_IMAGE_SDK_PROVIDER = 'hunyuan-image';
const HY_IMAGE_PLUS_SUB_URL = 'images/ar/generations';

export type HunyuanGenerateImageInput = {
  prompt: string;
  size: string;
};

@Injectable()
export class HunyuanImageClient {
  private readonly logger = new Logger(HunyuanImageClient.name);
  readonly enabled: boolean;

  private readonly envId: string;
  private readonly imageModel: string;
  private readonly accessKey: string;
  private readonly secretId: string;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.envId = this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    this.imageModel =
      this.config.get<string>('imageGeneration.imageModel')?.trim() ?? '';
    this.accessKey =
      this.config.get<string>('cloudbase.apiKey')?.trim() ??
      this.config.get<string>('hunyuan.apiKey')?.trim() ??
      '';
    this.secretId = this.config.get<string>('cloudbase.secretId')?.trim() ?? '';
    this.secretKey =
      this.config.get<string>('cloudbase.secretKey')?.trim() ?? '';

    const featureEnabled =
      this.config.get<boolean>('imageGeneration.enabled') !== false;
    this.enabled =
      featureEnabled && Boolean(this.envId) && Boolean(this.imageModel);
  }

  async generateImage(
    input: HunyuanGenerateImageInput,
  ): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    const prompt = input.prompt.trim();
    if (!prompt) {
      return null;
    }

    try {
      const cloudbase = await import('@cloudbase/node-sdk');
      const initOptions: Record<string, unknown> = {
        env: this.envId,
        timeout: 150_000,
      };
      if (this.accessKey) {
        initOptions.accessKey = this.accessKey;
      } else if (this.secretId && this.secretKey) {
        initOptions.secretId = this.secretId;
        initOptions.secretKey = this.secretKey;
      }

      const app = cloudbase.init(initOptions);
      const imageModel = app
        .ai()
        .createImageModel(CLOUDBASE_IMAGE_SDK_PROVIDER);
      this.configurePlusModelSubUrl(imageModel);

      const res = (await imageModel.generateImage({
        model: this.imageModel,
        prompt,
        size: input.size,
        revise: { value: false },
        enable_thinking: { value: false },
      } as never)) as { data?: Array<{ url?: string }> };

      const url = res?.data?.[0]?.url?.trim();
      if (!url) {
        this.logger.warn(
          `Image generation (${this.imageModel}) returned empty url`,
        );
        return null;
      }
      return url;
    } catch (error) {
      this.logger.warn(
        `Image generation (${this.imageModel}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private configurePlusModelSubUrl(imageModel: {
    generateImageSubUrlConfig: Record<string, Record<string, string>>;
  }): void {
    if (this.imageModel !== HY_IMAGE_PLUS_MODEL) {
      return;
    }

    // @cloudbase/ai < 2.30 needs explicit sub-path; harmless on 2.30+.
    imageModel.generateImageSubUrlConfig[CLOUDBASE_IMAGE_SDK_PROVIDER] ??= {};
    imageModel.generateImageSubUrlConfig[CLOUDBASE_IMAGE_SDK_PROVIDER][
      HY_IMAGE_PLUS_MODEL
    ] = HY_IMAGE_PLUS_SUB_URL;
  }
}
