import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { decodeBase64Payload } from '../../ai/utils/image-base64.util';
import type { WechatContentSecurityService } from '../../modules/auth/wechat-content-security.service';
import { WECHAT_IMG_SEC_CHECK_MAX_BYTES } from '../../modules/auth/wechat-content-security.service';
import type { MediaSecurityCheckService } from '../../modules/media-security/media-security-check.service';
import {
  isAllowedUserUploadImageUrl,
  isCloudStorageFileId,
} from './user-image-ref.util';

const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 8_000;

/** Legacy `/uploads/` HTTPS URLs: ensure WeChat async media_check approved before persisting UGC. */
export async function assertUserUgcImages(
  security: WechatContentSecurityService,
  mediaChecks: MediaSecurityCheckService,
  imageUrls: string[],
  userId: string,
): Promise<void> {
  if (!security.isEnabled() || !imageUrls.length) {
    return;
  }
  const legacyUrls = imageUrls.filter((url) => !isCloudStorageFileId(url));
  if (!legacyUrls.length) {
    return;
  }
  await mediaChecks.assertImagesApprovedForUser(legacyUrls, userId);
}

/** Sync WeChat img_sec_check for inline base64 image payloads (e.g. receipt OCR). */
export async function assertUserUgcImageDataUrl(
  security: WechatContentSecurityService,
  image: string,
): Promise<void> {
  if (!security.isEnabled()) {
    return;
  }
  const { mimeType, base64, bytes } = decodeBase64Payload(image);
  const buffer = Buffer.from(base64, 'base64');
  await security.assertImageSafe({ buffer, mime: mimeType, size: bytes });
}

/** Sync WeChat img_sec_check for third-party HTTPS image URLs (e.g. WeChat avatar). */
export async function assertUserUgcRemoteImageUrl(
  security: WechatContentSecurityService,
  imageUrl: string,
): Promise<void> {
  if (!security.isEnabled()) {
    return;
  }

  const trimmed = imageUrl.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return;
  }
  if (isAllowedUserUploadImageUrl(trimmed)) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REMOTE_IMAGE_FETCH_TIMEOUT_MS,
  );

  try {
    const res = await fetch(trimmed, {
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new BadRequestException('无法读取图片进行安全检测，请更换后重试');
    }

    const contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ||
      'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > WECHAT_IMG_SEC_CHECK_MAX_BYTES) {
      throw new BadRequestException('图片不能超过 1MB（微信内容安全检测限制）');
    }

    await security.assertImageSafe({
      buffer,
      mime: contentType,
      size: buffer.length,
    });
  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof ServiceUnavailableException
    ) {
      throw error;
    }
    throw new ServiceUnavailableException('图片安全检测暂不可用，请稍后重试');
  } finally {
    clearTimeout(timeout);
  }
}

/** Avatar / single-image fields: legacy `/uploads/` refs only (cloud fileIDs skip server checks). */
export async function assertUserUgcImageRef(
  security: WechatContentSecurityService,
  mediaChecks: MediaSecurityCheckService,
  imageUrl: string | undefined,
  userId: string,
): Promise<void> {
  const trimmed = imageUrl?.trim();
  if (!trimmed || isCloudStorageFileId(trimmed)) {
    return;
  }
  if (!isAllowedUserUploadImageUrl(trimmed)) {
    return;
  }
  await assertUserUgcImages(security, mediaChecks, [trimmed], userId);
}
