import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private readonly imageVersion: string;
  private readonly accessKey: string;
  private readonly secretId: string;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.envId = this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    this.imageModel =
      this.config.get<string>('imageGeneration.imageModel')?.trim() ?? '';
    this.imageVersion =
      this.config.get<string>('imageGeneration.imageVersion') ?? 'v1.9';
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
      const initOptions: Record<string, unknown> = { env: this.envId };
      if (this.secretId && this.secretKey) {
        initOptions.secretId = this.secretId;
        initOptions.secretKey = this.secretKey;
      } else if (this.accessKey) {
        initOptions.accessKey = this.accessKey;
      }

      const app = cloudbase.init(initOptions);
      const ai = app.ai();
      const imageModel = ai.createImageModel(this.imageModel);
      const res = (await imageModel.generateImage({
        model: this.imageModel,
        prompt,
        size: input.size,
        version: this.imageVersion as 'v1.9',
        revise: false,
      })) as { data?: Array<{ url?: string }> };

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
}
