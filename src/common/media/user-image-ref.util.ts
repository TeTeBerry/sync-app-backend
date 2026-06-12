import { BadRequestException } from '@nestjs/common';
import { URL } from 'url';
import { isLegacyLocalUploadEnabled } from './local-upload.util';

/** Shown when clients send base64 / data URLs instead of a prior upload ref. */
export const USER_IMAGE_MUST_UPLOAD_MESSAGE =
  '请先上传图片（小程序云存储上传后再提交）';

export const USER_IMAGE_URL_INVALID_MESSAGE = '图片地址无效，请重新上传';

const CLOUD_FILE_ID_RE = /^cloud:\/\/[^/]+\/.+/;
const CLOUD_UGC_PATH_PREFIX = 'ugc/';

/** CloudBase storage fileID from `wx.cloud.uploadFile` (client resolves temp URL). */
export function isCloudStorageFileId(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || !CLOUD_FILE_ID_RE.test(trimmed)) {
    return false;
  }
  try {
    const withoutScheme = trimmed.slice('cloud://'.length);
    const slash = withoutScheme.indexOf('/');
    if (slash <= 0) return false;
    const objectPath = withoutScheme.slice(slash + 1);
    if (!objectPath.startsWith(CLOUD_UGC_PATH_PREFIX)) return false;
    if (objectPath.includes('..')) return false;
    return true;
  } catch {
    return false;
  }
}

function resolveCloudbaseEnvId(): string {
  return process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
}

/** When `CLOUDBASE_ENV_ID` is set, fileID must belong to that env. */
export function assertCloudStorageFileIdForEnv(fileId: string): void {
  const trimmed = fileId.trim();
  if (!isCloudStorageFileId(trimmed)) {
    throw new BadRequestException(USER_IMAGE_URL_INVALID_MESSAGE);
  }
  const expectedEnv = resolveCloudbaseEnvId();
  if (!expectedEnv) {
    return;
  }
  const envSegment = trimmed.slice('cloud://'.length).split('/')[0] ?? '';
  if (!envSegment.startsWith(expectedEnv)) {
    throw new BadRequestException(USER_IMAGE_URL_INVALID_MESSAGE);
  }
}

export function resolveUploadPublicBase(): string {
  const configured = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const port = process.env.PORT?.trim() || '3000';
  return `http://127.0.0.1:${port}`;
}

function isBackendLocalUploadUrl(parsed: URL): boolean {
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

  return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
}

/** User UGC images: CloudBase fileID or legacy backend `/uploads/` static files. */
export function isAllowedUserUploadImageRef(raw: string): boolean {
  if (isCloudStorageFileId(raw)) {
    return true;
  }
  return isAllowedUserUploadImageUrl(raw);
}

/** Local dev only: backend-served `/uploads/` URLs (disabled on CloudBase Run production). */
export function isAllowedUserUploadImageUrl(raw: string): boolean {
  if (!isLegacyLocalUploadEnabled()) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  return isBackendLocalUploadUrl(parsed);
}

export function assertUserImageRefSync(ref: string): void {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error('图片数据为空');
  }

  if (/^data:/i.test(trimmed)) {
    throw new BadRequestException(USER_IMAGE_MUST_UPLOAD_MESSAGE);
  }

  if (isCloudStorageFileId(trimmed)) {
    assertCloudStorageFileIdForEnv(trimmed);
    return;
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
