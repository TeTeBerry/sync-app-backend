import { decodeBase64Payload } from '../../ai/utils/image-base64.util';
import type { WechatContentSecurityService } from '../../modules/auth/wechat-content-security.service';
import type { MediaSecurityCheckService } from '../../modules/media-security/media-security-check.service';
import { isAllowedUserUploadImageUrl } from './user-image-ref.util';

/** Ensure COS upload URLs passed WeChat media security before persisting UGC. */
export async function assertUserUgcImages(
  security: WechatContentSecurityService,
  mediaChecks: MediaSecurityCheckService,
  imageUrls: string[],
  userId: string,
): Promise<void> {
  if (!security.isEnabled() || !imageUrls.length) {
    return;
  }
  await mediaChecks.assertImagesApprovedForUser(imageUrls, userId);
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

/** Avatar / single-image profile fields that reference a prior COS upload. */
export async function assertUserUgcImageRef(
  security: WechatContentSecurityService,
  mediaChecks: MediaSecurityCheckService,
  imageUrl: string | undefined,
  userId: string,
): Promise<void> {
  const trimmed = imageUrl?.trim();
  if (!trimmed || !isAllowedUserUploadImageUrl(trimmed)) {
    return;
  }
  await assertUserUgcImages(security, mediaChecks, [trimmed], userId);
}
