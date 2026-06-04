import { BadRequestException } from '@nestjs/common';
import { URL } from 'url';

/** Shown when clients send base64 / data URLs instead of upload API URLs. */
export const USER_IMAGE_MUST_UPLOAD_MESSAGE =
  '请先通过图片上传接口上传图片（上传时会进行微信内容安全检测）';

export const USER_IMAGE_URL_INVALID_MESSAGE = '图片地址无效，请重新上传';

export function resolveUploadPublicBase(): string {
  const configured = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const port = process.env.PORT?.trim() || '3000';
  return `http://127.0.0.1:${port}`;
}

/** User UGC images must reference files saved via POST /uploads/images (wx img_sec_check). */
export function isAllowedUserUploadImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (!pathname.includes('/uploads/')) {
    return false;
  }

  const allowedBase = resolveUploadPublicBase();
  try {
    const allowed = new URL(allowedBase);
    if (parsed.hostname === allowed.hostname && parsed.port === allowed.port) {
      return true;
    }
  } catch {
    // ignore
  }

  if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
    return true;
  }

  return false;
}

export function assertUserImageRefSync(ref: string): void {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error('图片数据为空');
  }

  if (/^data:/i.test(trimmed)) {
    throw new BadRequestException(USER_IMAGE_MUST_UPLOAD_MESSAGE);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (!isAllowedUserUploadImageUrl(trimmed)) {
      throw new BadRequestException(USER_IMAGE_URL_INVALID_MESSAGE);
    }
    return;
  }

  throw new BadRequestException(USER_IMAGE_URL_INVALID_MESSAGE);
}

export function normalizeUserImageUrls(images?: string[]): string[] {
  if (!images?.length) return [];
  return images.map((url) => {
    assertUserImageRefSync(url);
    return url.trim();
  });
}
