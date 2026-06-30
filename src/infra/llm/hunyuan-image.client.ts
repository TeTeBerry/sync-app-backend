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
  private readonly imageVersion: string;
  private readonly accessKey: string;
  private readonly secretId: string;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.envId = this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    this.imageVersion =
      this.config.get<string>('posterBackground.imageVersion') ?? 'v1.9';
    this.accessKey =
      this.config.get<string>('cloudbase.apiKey')?.trim() ??
      this.config.get<string>('hunyuan.apiKey')?.trim() ??
      '';
    this.secretId =
      this.config.get<string>('cloudbase.secretId')?.trim() ??
      process.env.TENCENTCLOUD_SECRETID?.trim() ??
      '';
    this.secretKey =
      this.config.get<string>('cloudbase.secretKey')?.trim() ??
      process.env.TENCENTCLOUD_SECRETKEY?.trim() ??
      '';

    const featureEnabled =
      this.config.get<boolean>('posterBackground.enabled') !== false;
    this.enabled = featureEnabled && Boolean(this.envId);
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
      const imageModel = ai.createImageModel('hunyuan-image');
      const res = await imageModel.generateImage({
        model: 'hunyuan-image',
        prompt,
        size: input.size,
        version: this.imageVersion as 'v1.9',
        revise: false,
      });

      const url = res?.data?.[0]?.url?.trim();
      if (!url) {
        this.logger.warn('Hunyuan image generation returned empty url');
        return null;
      }
      return url;
    } catch (error) {
      this.logger.warn(
        `Hunyuan image generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
