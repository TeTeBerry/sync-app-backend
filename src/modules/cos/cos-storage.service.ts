import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  parseCosObjectKeyFromUrl,
  assertCosPostImageUrlForUser,
} from '../../common/cos/cos-upload-url.util';
import { resolveCosPublicBaseUrl } from '../../common/cos/cos-config.util';

// cos-nodejs-sdk-v5 is CJS; keep a narrow callback surface for Nest tsc.
type CosSdkClient = {
  putObject(
    params: Record<string, unknown>,
    callback: (err: unknown, data?: unknown) => void,
  ): void;
  getObject(
    params: Record<string, unknown>,
    callback: (
      err: unknown,
      data?: { Body?: unknown; headers?: unknown },
    ) => void,
  ): void;
  deleteObject(
    params: Record<string, unknown>,
    callback: (err: unknown, data?: unknown) => void,
  ): void;
  getObjectUrl(
    params: Record<string, unknown>,
    callback: (err: unknown, data?: { Url?: string }) => void,
  ): void;
};

// cos-nodejs-sdk-v5 ships CJS only; dynamic import is async and unsuitable here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CosSdk = require('cos-nodejs-sdk-v5') as new (options: {
  SecretId: string;
  SecretKey: string;
}) => CosSdkClient;

/**
 * Server-side COS SDK (COS_SECRET_ID / COS_SECRET_KEY).
 * verify 拉图优先 HTTP 公网 URL；失败再 SDK getObject（需 cos:GetObject 权限）。
 * 违规删图用 deleteObject（仅需 cos:DeleteObject）。multipart 落库用 putObject。
 */
@Injectable()
export class CosStorageService {
  private readonly logger = new Logger(CosStorageService.name);
  private client: CosSdkClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): CosSdkClient {
    if (this.client) return this.client;

    const secretId = this.config.get<string>('cos.serverSecretId', '');
    const secretKey = this.config.get<string>('cos.serverSecretKey', '');
    if (!secretId || !secretKey) {
      throw new ServiceUnavailableException(
        '未配置 COS_SECRET_ID / COS_SECRET_KEY（服务端专用）',
      );
    }

    this.client = new CosSdk({
      SecretId: secretId,
      SecretKey: secretKey,
    });
    return this.client;
  }

  private bucket(): string {
    return this.config.getOrThrow<string>('cos.bucket');
  }

  private region(): string {
    return this.config.getOrThrow<string>('cos.region');
  }

  async putObject(params: {
    key: string;
    buffer: Buffer;
    mime: string;
  }): Promise<string> {
    const key = params.key.replace(/^\/+/, '');
    if (!key || key.includes('..')) {
      throw new BadRequestException('无效的对象路径');
    }

    await new Promise<void>((resolve, reject) => {
      this.getClient().putObject(
        {
          Bucket: this.bucket(),
          Region: this.region(),
          Key: key,
          Body: params.buffer,
          ContentType: params.mime,
        },
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        },
      );
    }).catch((error: unknown) => {
      this.logger.warn(
        `COS putObject failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('图片上传失败，请稍后重试');
    });

    return `${resolveCosPublicBaseUrl()}/${key}`;
  }

  async fetchObjectByUrl(imageUrl: string): Promise<{
    buffer: Buffer;
    mime: string;
    size: number;
  }> {
    const key = parseCosObjectKeyFromUrl(imageUrl);
    const trimmed = imageUrl.trim();

    const viaHttp = await this.fetchObjectViaHttp(trimmed, key);
    if (viaHttp) {
      return viaHttp;
    }

    const result = await new Promise<{
      Body: Buffer;
      headers?: Record<string, string>;
    }>((resolve, reject) => {
      this.getClient().getObject(
        {
          Bucket: this.bucket(),
          Region: this.region(),
          Key: key,
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          const body = data?.Body;
          if (!body || !Buffer.isBuffer(body)) {
            reject(new Error('COS object body missing'));
            return;
          }
          resolve({
            Body: body,
            headers: data?.headers as Record<string, string> | undefined,
          });
        },
      );
    }).catch((error: unknown) => {
      this.logger.warn(
        `COS getObject failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException(
        '无法读取上传的图片：请确认 COS 公网可读 uploads/posts/*，或为服务端子账号添加 cos:GetObject 权限',
      );
    });

    const mime =
      result.headers?.['content-type']?.split(';')[0]?.trim().toLowerCase() ||
      inferMimeFromKey(key);

    return {
      buffer: result.Body,
      mime,
      size: result.Body.length,
    };
  }

  private async fetchObjectViaHttp(
    imageUrl: string,
    key: string,
  ): Promise<{ buffer: Buffer; mime: string; size: number } | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) {
        return null;
      }
      const mime =
        response.headers
          .get('content-type')
          ?.split(';')[0]
          ?.trim()
          .toLowerCase() || inferMimeFromKey(key);
      return { buffer, mime, size: buffer.length };
    } catch (error) {
      this.logger.warn(
        `COS HTTP fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async deleteObjectForUser(imageUrl: string, userId: string): Promise<void> {
    const key = assertCosPostImageUrlForUser(imageUrl, userId);
    await this.deleteObjectByKey(key);
  }

  async deleteObjectByKey(key: string): Promise<void> {
    const normalized = key.replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.getClient().deleteObject(
        {
          Bucket: this.bucket(),
          Region: this.region(),
          Key: normalized,
        },
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        },
      );
    }).catch((error: unknown) => {
      this.logger.warn(
        `COS deleteObject failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  async getSignedObjectUrl(
    key: string,
    expiresSeconds?: number,
  ): Promise<string> {
    const normalized = key.replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new BadRequestException('无效的对象路径');
    }
    const expires =
      expiresSeconds ??
      this.config.get<number>('cos.signedUrlExpiresSeconds', 3600);

    return new Promise<string>((resolve, reject) => {
      this.getClient().getObjectUrl(
        {
          Bucket: this.bucket(),
          Region: this.region(),
          Key: normalized,
          Sign: true,
          Expires: expires,
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          const url = data?.Url?.trim();
          if (!url) {
            reject(new Error('COS signed URL missing'));
            return;
          }
          resolve(url);
        },
      );
    }).catch((error: unknown) => {
      this.logger.warn(
        `COS getObjectUrl failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('图片访问链接生成失败');
    });
  }
}

function inferMimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
