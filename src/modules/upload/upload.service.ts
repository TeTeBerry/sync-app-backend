import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  buildCosPostImageObjectKey,
  mimeToCosExtension,
} from '../../common/cos/cos-object-key.util';
import {
  assertCosPostImageUrlForUser,
  normalizeCosPostImageUrl,
  parseCosObjectKeyFromUrl,
} from '../../common/cos/cos-upload-url.util';
import { CosStorageService } from '../cos/cos-storage.service';
import {
  WechatContentSecurityService,
  WECHAT_IMG_SEC_CHECK_MAX_BYTES,
} from '../auth/wechat-content-security.service';
import { MediaSecurityCheckService } from '../media-security/media-security-check.service';
import type { MediaSecurityCheckStatus } from '../../database/schemas/media-security-check.schema';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype?: string;
  size: number;
  originalname?: string;
};

export type VerifyCosUploadResult = {
  url: string;
  status: MediaSecurityCheckStatus | 'approved';
  traceId?: string;
  displayUrl?: string;
};

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly cosStorage: CosStorageService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  private validateImageFile(file: UploadedImageFile): {
    mime: string;
    buffer: Buffer;
  } {
    if (!file?.buffer?.length) {
      throw new BadRequestException('未收到图片文件');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('图片不能超过 2MB');
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('仅支持 JPEG、PNG、WebP 图片');
    }
    if (
      this.wechatContentSecurity.isEnabled() &&
      !this.wechatContentSecurity.isAsyncImageCheckEnabled() &&
      file.size > WECHAT_IMG_SEC_CHECK_MAX_BYTES
    ) {
      throw new BadRequestException('图片不能超过 1MB（微信内容安全检测限制）');
    }
    return { mime, buffer: file.buffer };
  }

  private async assertImageSafeOrThrow(params: {
    buffer: Buffer;
    mime: string;
    size: number;
  }): Promise<void> {
    await this.wechatContentSecurity.assertImageSafe(params);
  }

  private async buildApprovedView(
    imageUrl: string,
    userId: string,
  ): Promise<VerifyCosUploadResult> {
    const url = normalizeCosPostImageUrl(imageUrl);
    const key = parseCosObjectKeyFromUrl(url);
    return {
      url,
      status: 'approved',
      displayUrl: await this.cosStorage.getSignedObjectUrl(key),
    };
  }

  /** Multipart upload to COS, then async/sync security verify. */
  async saveImageFile(
    file: UploadedImageFile,
    userId: string,
  ): Promise<VerifyCosUploadResult> {
    const { mime, buffer } = this.validateImageFile(file);
    const ext = mimeToCosExtension(mime, file.originalname);
    const key = buildCosPostImageObjectKey(userId, ext);
    const url = await this.cosStorage.putObject({ key, buffer, mime });
    return this.verifyCosUpload(url, userId);
  }

  /**
   * After client STS upload to COS: submit WeChat media_check_async (default)
   * or sync img_sec_check when WECHAT_IMAGE_CHECK_MODE=sync.
   */
  async verifyCosUpload(
    imageUrl: string,
    userId: string,
  ): Promise<VerifyCosUploadResult> {
    const trimmed = imageUrl.trim();
    assertCosPostImageUrlForUser(trimmed, userId);
    const normalized = normalizeCosPostImageUrl(trimmed);

    if (!this.wechatContentSecurity.isEnabled()) {
      return this.buildApprovedView(normalized, userId);
    }

    if (this.wechatContentSecurity.isAsyncImageCheckEnabled()) {
      return this.verifyCosUploadAsync(normalized, userId);
    }

    return this.verifyCosUploadSync(normalized, userId);
  }

  private async verifyCosUploadAsync(
    normalized: string,
    userId: string,
  ): Promise<VerifyCosUploadResult> {
    const existing = await this.mediaChecks.findByImageUrl(normalized, userId);
    if (existing) {
      const refreshed = await this.mediaChecks.expireIfNeeded(existing);
      if (refreshed.status === 'approved') {
        return this.mediaChecks.toView(refreshed, userId);
      }
      if (refreshed.status === 'pending') {
        return this.mediaChecks.toView(refreshed, userId);
      }
      if (
        refreshed.status === 'rejected' ||
        refreshed.status === 'expired' ||
        refreshed.status === 'submit_failed'
      ) {
        throw new BadRequestException('图片未通过安全检测，请更换后重试');
      }
    }

    const openid = await this.mediaChecks.resolveOpenid(userId);
    const scene = this.wechatContentSecurity.mediaCheckScene();
    const expiresAt = new Date(
      Date.now() +
        this.wechatContentSecurity.mediaCheckExpireMinutes() * 60 * 1000,
    );

    const cosKey = parseCosObjectKeyFromUrl(normalized);
    const mediaUrlForWechat = await this.cosStorage.getSignedObjectUrl(
      cosKey,
      1800,
    );

    try {
      const { traceId } =
        await this.wechatContentSecurity.submitImageCheckAsync({
          mediaUrl: mediaUrlForWechat,
          openid,
          scene,
        });
      const record = await this.mediaChecks.createPending({
        traceId,
        userId,
        openid,
        imageUrl: normalized,
        scene,
        expiresAt,
      });
      return this.mediaChecks.toView(record, userId);
    } catch (error) {
      this.logger.warn(
        `media_check_async submit failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.mediaChecks.markSubmitFailed(
        normalized,
        userId,
        openid,
        scene,
        expiresAt,
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }

  private async verifyCosUploadSync(
    normalized: string,
    userId: string,
  ): Promise<VerifyCosUploadResult> {
    const fetched = await this.cosStorage.fetchObjectByUrl(normalized);
    const mime = normalizeUploadImageMime(fetched.mime, normalized);
    const { buffer, size } = fetched;
    if (size > MAX_BYTES) {
      await this.cosStorage.deleteObjectForUser(normalized, userId);
      throw new BadRequestException('图片不能超过 2MB');
    }
    if (!ALLOWED_MIME.has(mime)) {
      await this.cosStorage.deleteObjectForUser(normalized, userId);
      throw new BadRequestException('仅支持 JPEG、PNG、WebP 图片');
    }
    if (size > WECHAT_IMG_SEC_CHECK_MAX_BYTES) {
      await this.cosStorage.deleteObjectForUser(normalized, userId);
      throw new BadRequestException('图片不能超过 1MB（微信内容安全检测限制）');
    }

    try {
      await this.assertImageSafeOrThrow({ buffer, mime, size });
    } catch (error) {
      await this.cosStorage.deleteObjectForUser(normalized, userId);
      throw error;
    }

    const openid = await this.mediaChecks
      .resolveOpenid(userId)
      .catch(() => userId);
    await this.mediaChecks.recordApproved({
      userId,
      openid,
      imageUrl: normalized,
      scene: this.wechatContentSecurity.mediaCheckScene(),
    });
    return this.buildApprovedView(normalized, userId);
  }

  async getCheckStatus(
    urls: string[],
    userId: string,
  ): Promise<VerifyCosUploadResult[]> {
    const results: VerifyCosUploadResult[] = [];
    for (const raw of urls) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      let normalized: string;
      try {
        normalized = normalizeCosPostImageUrl(trimmed);
        assertCosPostImageUrlForUser(normalized, userId);
      } catch {
        throw new BadRequestException('图片地址无效，请重新上传');
      }
      const record = await this.mediaChecks.findByImageUrl(normalized, userId);
      if (!record) {
        results.push({ url: normalized, status: 'submit_failed' });
        continue;
      }
      results.push(await this.mediaChecks.toView(record, userId));
    }
    return results;
  }

  async resolveSignedDisplayUrls(
    urls: string[],
    userId: string,
  ): Promise<Array<{ inputUrl: string; url: string; displayUrl?: string }>> {
    return this.mediaChecks.resolveSignedDisplayUrls(urls, userId);
  }
}

function normalizeUploadImageMime(mime: string, imageUrl: string): string {
  const lower = mime?.toLowerCase() || '';
  if (ALLOWED_MIME.has(lower)) {
    return lower;
  }
  const key = imageUrl.toLowerCase();
  if (key.includes('.png')) return 'image/png';
  if (key.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}
