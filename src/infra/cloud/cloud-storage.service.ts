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

  /** Resolve `cloud://` fileID to a data URL for vision APIs. */
  async fetchUgcImageAsDataUrl(fileId: string): Promise<string> {
    const downloadUrl = await this.fetchCloudFileDownloadUrl(fileId, {
      validate: (id) => {
        if (!isCloudStorageFileId(id)) {
          throw new BadRequestException('图片地址无效，请重新上传');
        }
        assertCloudStorageFileIdForEnv(id);
      },
      invalidMessage: '无法读取上传的截图，请重试',
    });
    return fetchRemoteImageAsDataUrl(downloadUrl);
  }

  /** Resolve CloudBase fileIDs to HTTPS download URLs (WeChat `batchdownloadfile`). */
  async fetchCloudFileDownloadUrls(
    fileIds: string[],
    validate: (fileId: string) => void,
    invalidMessage = '无法读取云存储文件',
  ): Promise<string[]> {
    const candidates = fileIds.map((id) => id.trim()).filter(Boolean);
    if (!candidates.length) {
      return [];
    }

    for (const fileId of candidates) {
      validate(fileId);
    }

    if (!this.envId) {
      throw new ServiceUnavailableException('云存储未配置，无法读取文件');
    }
    if (!this.accessToken.isConfigured()) {
      throw new ServiceUnavailableException('微信凭证未配置，无法读取文件');
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
            file_list: candidates.map((fileid) => ({
              fileid,
              max_age: 3600,
            })),
          }),
        },
      );
      const payload = (await response.json()) as WechatBatchDownloadResponse;
      if (payload.errcode && payload.errcode !== 0) {
        throw new BadRequestException(
          payload.errmsg || `读取云存储失败 (${payload.errcode})`,
        );
      }

      return candidates.map((fileId, index) => {
        const row = payload.file_list?.[index];
        const downloadUrl =
          row?.fileid === fileId ? row.download_url?.trim() : '';
        if (!downloadUrl || row?.status !== 0) {
          this.logger.warn(
            `cloud file download unavailable: ${fileId} status=${row?.status ?? 'missing'}`,
          );
          return '';
        }
        return downloadUrl;
      });
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
      throw new BadRequestException(invalidMessage);
    }
  }

  private async fetchCloudFileDownloadUrl(
    fileId: string,
    options: {
      validate: (fileId: string) => void;
      invalidMessage: string;
    },
  ): Promise<string> {
    const [downloadUrl] = await this.fetchCloudFileDownloadUrls(
      [fileId],
      options.validate,
      options.invalidMessage,
    );
    if (!downloadUrl) {
      throw new BadRequestException(options.invalidMessage);
    }
    return downloadUrl;
  }
}
