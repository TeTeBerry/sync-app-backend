import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sts } from 'tencentcloud-sdk-nodejs';

const COS_UPLOAD_ACTIONS = [
  'name/cos:PutObject',
  'name/cos:InitiateMultipartUpload',
  'name/cos:UploadPart',
  'name/cos:CompleteMultipartUpload',
  'name/cos:AbortMultipartUpload',
] as const;

export type CosStsKey = {
  TmpSecretId: string;
  TmpSecretKey: string;
  SessionToken: string;
  ExpiredTime: number;
};

@Injectable()
export class CosService {
  private readonly logger = new Logger(CosService.name);
  private client: InstanceType<typeof sts.v20180813.Client> | null = null;

  constructor(private readonly config: ConfigService) {}

  private resolveClient(): InstanceType<typeof sts.v20180813.Client> {
    if (this.client) return this.client;

    const secretId = this.config.get<string>('cos.stsSecretId', '');
    const secretKey = this.config.get<string>('cos.stsSecretKey', '');
    if (!secretId || !secretKey) {
      throw new ServiceUnavailableException(
        '未配置 TENCENT_STS_SECRET_ID / TENCENT_STS_SECRET_KEY',
      );
    }

    this.client = new sts.v20180813.Client({
      credential: { secretId, secretKey },
      region: this.config.getOrThrow<string>('cos.region'),
    });
    return this.client;
  }

  private buildUploadResource(userId: string): string {
    const safeUserId = userId.trim();
    if (!safeUserId) {
      throw new UnauthorizedException('请先登录');
    }
    if (/[/*{}]/.test(safeUserId)) {
      throw new BadRequestException('Invalid user id');
    }

    const template = this.config.get<string>('cos.uploadResource', '');
    if (!template) {
      throw new ServiceUnavailableException('未配置 COS_UPLOAD_RESOURCE');
    }
    if (!template.includes('{userId}')) {
      throw new ServiceUnavailableException(
        'COS_UPLOAD_RESOURCE 须包含 {userId} 占位符',
      );
    }

    return template.replaceAll('{userId}', safeUserId);
  }

  async getStsKey(userId: string): Promise<CosStsKey> {
    const region = this.config.getOrThrow<string>('cos.region');
    const durationSeconds = this.config.getOrThrow<number>(
      'cos.stsDurationSeconds',
    );
    const resource = this.buildUploadResource(userId);

    const policy = {
      version: '2.0',
      statement: [
        {
          action: [...COS_UPLOAD_ACTIONS],
          effect: 'allow',
          resource: [resource],
        },
      ],
    };

    try {
      const response = await this.resolveClient().GetFederationToken({
        Name: 'sync-app-cos-upload',
        Policy: JSON.stringify(policy),
        DurationSeconds: durationSeconds,
      });

      const credentials = response.Credentials;
      if (
        !credentials?.TmpSecretId ||
        !credentials.TmpSecretKey ||
        !credentials.Token
      ) {
        throw new ServiceUnavailableException('COS 临时密钥获取失败');
      }

      return {
        TmpSecretId: credentials.TmpSecretId,
        TmpSecretKey: credentials.TmpSecretKey,
        SessionToken: credentials.Token,
        ExpiredTime: response.ExpiredTime ?? 0,
      };
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.warn(
        `COS STS failed (region=${region}): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('COS 临时密钥服务暂不可用');
    }
  }
}
