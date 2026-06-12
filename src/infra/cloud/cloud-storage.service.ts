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
import { fetchRemoteImageAsDataUrl } from '../../ai/utils/image-ref.util';
import { WechatAccessTokenService } from '../../modules/auth/wechat-access-token.service';

type WechatBatchDownloadResponse = {
  errcode?: number;
  errmsg?: string;
  file_list?: Array<{
    fileid?: string;
    download_url?: string;
    status?: number;
    errcode?: number;
    errmsg?: string;
  }>;
};

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly accessToken: WechatAccessTokenService,
  ) {}

  private get envId(): string {
    return this.config.get<string>('cloudbase.envId')?.trim() ?? '';
  }

  get enabled(): boolean {
    return Boolean(this.envId && this.accessToken.isConfigured());
  }

  /** Resolve `cloud://` fileID to a data URL for vision APIs. */
  async fetchUgcImageAsDataUrl(fileId: string): Promise<string> {
    const trimmed = fileId.trim();
    if (!isCloudStorageFileId(trimmed)) {
      throw new BadRequestException('图片地址无效，请重新上传');
    }
    assertCloudStorageFileIdForEnv(trimmed);

    if (!this.envId) {
      throw new ServiceUnavailableException('云存储未配置，无法读取截图');
    }
    if (!this.accessToken.isConfigured()) {
      throw new ServiceUnavailableException('微信凭证未配置，无法读取截图');
    }

    try {
      const token = await this.accessToken.getAccessToken();
      const response = await fetch(
        `https://api.weixin.qq.com/tcb/batchdownloadfile?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            env: this.envId,
            file_list: [{ fileid: trimmed, max_age: 3600 }],
          }),
        },
      );
      const payload = (await response.json()) as WechatBatchDownloadResponse;
      if (payload.errcode && payload.errcode !== 0) {
        throw new BadRequestException(
          payload.errmsg || `读取云存储失败 (${payload.errcode})`,
        );
      }

      const row = payload.file_list?.[0];
      const downloadUrl = row?.download_url?.trim();
      if (!downloadUrl || row?.status !== 0) {
        throw new BadRequestException('无法读取上传的截图，请重试');
      }

      return fetchRemoteImageAsDataUrl(downloadUrl);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      this.logger.warn(
        `cloud file fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException('无法读取上传的截图，请重试');
    }
  }
}
