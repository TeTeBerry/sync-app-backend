import { BadRequestException, Logger } from '@nestjs/common';
import {
  assertUserImageRefSync,
  isAllowedUserUploadImageUrl,
  isCloudBaseTempImageUrl,
  USER_IMAGE_URL_INVALID_MESSAGE,
} from '../../common/media/user-image-ref.util';
import { decodeBase64Payload, ImageTooLargeError } from './image-base64.util';

const logger = new Logger('ImageRefUtil');

export { ImageTooLargeError };
export {
  assertUserImageRefSync,
  isAllowedUserUploadImageUrl,
  normalizeUserImageUrls,
  USER_IMAGE_MUST_UPLOAD_MESSAGE,
  USER_IMAGE_URL_INVALID_MESSAGE,
} from '../../common/media/user-image-ref.util';

async function fetchUploadAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new BadRequestException('无法读取上传的图片');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  decodeBase64Payload(`data:image/jpeg;base64,${buffer.toString('base64')}`);

  const contentType =
    response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new BadRequestException('仅支持图片文件');
  }

  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/**
 * Fetches a legacy backend `/uploads/` HTTPS URL or CloudBase temp URL as a data URL for VL APIs.
 * cloud:// fileIDs are validated elsewhere but cannot be read server-side here.
 */
export async function resolveImageInput(ref: string): Promise<string> {
  const trimmed = ref.trim();
  if (isCloudBaseTempImageUrl(trimmed)) {
    return fetchUploadAsDataUrl(trimmed);
  }

  assertUserImageRefSync(trimmed);
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new BadRequestException(USER_IMAGE_URL_INVALID_MESSAGE);
  }
  if (!isAllowedUserUploadImageUrl(trimmed)) {
    logger.warn(`Rejected image URL host/path: ${trimmed}`);
    throw new BadRequestException(USER_IMAGE_URL_INVALID_MESSAGE);
  }
  return fetchUploadAsDataUrl(trimmed);
}

/** Sync validation for AI WS / REST image fields. */
export function validateImageRefSync(ref: string): void {
  assertUserImageRefSync(ref);
}
