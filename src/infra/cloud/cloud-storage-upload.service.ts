import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatAccessTokenService } from '../../modules/auth/wechat-access-token.service';

type UploadFileResponse = {
  errcode?: number;
  errmsg?: string;
  url?: string;
  token?: string;
  authorization?: string;
  cos_file_id?: string;
  file_id?: string;
};

@Injectable()
export class CloudStorageUploadService {
  private readonly logger = new Logger(CloudStorageUploadService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly accessToken: WechatAccessTokenService,
  ) {}

  private get envId(): string {
    return this.config.get<string>('cloudbase.envId')?.trim() ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.envId) && this.accessToken.isConfigured();
  }

  async uploadBuffer(cloudPath: string, buffer: Buffer): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('云存储未配置，无法保存海报背景');
    }

    const normalizedPath = cloudPath.replace(/^\/+/, '');
    const token = await this.accessToken.getAccessToken();
    const payload = await this.requestUploadTicket(token, normalizedPath);

    const form = new FormData();
    form.append('key', normalizedPath);
    form.append('Signature', payload.authorization ?? '');
    form.append('x-cos-security-token', payload.token ?? '');
    form.append('x-cos-meta-fileid', payload.cos_file_id ?? '');
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)]),
      normalizedPath.split('/').pop() ?? 'poster.jpg',
    );

    const uploadResponse = await fetch(payload.url ?? '', {
      method: 'POST',
      body: form,
    });
    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      this.logger.warn(
        `COS upload failed for ${normalizedPath}: ${uploadResponse.status} ${text}`,
      );
      throw new ServiceUnavailableException('海报背景保存失败，请稍后重试');
    }

    return payload.file_id?.trim() || `cloud://${this.envId}/${normalizedPath}`;
  }

  private async requestUploadTicket(
    token: string,
    cloudPath: string,
  ): Promise<UploadFileResponse> {
    const response = await fetch(
      `https://api.weixin.qq.com/tcb/uploadfile?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          env: this.envId,
          path: cloudPath,
        }),
      },
    );
    const payload = (await response.json()) as UploadFileResponse;
    if (payload.errcode && payload.errcode !== 0) {
      throw new ServiceUnavailableException(
        payload.errmsg || `uploadfile failed (${payload.errcode})`,
      );
    }
    if (
      !payload.url ||
      !payload.token ||
      !payload.authorization ||
      !payload.cos_file_id
    ) {
      throw new ServiceUnavailableException('uploadfile response incomplete');
    }
    return payload;
  }
}
