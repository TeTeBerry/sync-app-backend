import { BadRequestException } from '@nestjs/common';

const CLOUD_FILE_ID_RE = /^cloud:\/\/[^/]+\/.+/;

export const ACTIVITY_STATIC_MEDIA_PREFIX = 'static/activity/';

export function activityImageCloudPath(code: string, ext = 'jpg'): string {
  const slug = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${ACTIVITY_STATIC_MEDIA_PREFIX}${slug || 'event'}.${ext}`;
}

export function isActivityStaticAssetKey(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.includes('..')) {
    return false;
  }
  return trimmed.startsWith(ACTIVITY_STATIC_MEDIA_PREFIX);
}

export function isActivityStaticCloudFileId(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || !CLOUD_FILE_ID_RE.test(trimmed)) {
    return false;
  }
  const withoutScheme = trimmed.slice('cloud://'.length);
  const slash = withoutScheme.indexOf('/');
  if (slash <= 0) {
    return false;
  }
  const objectPath = withoutScheme.slice(slash + 1);
  return isActivityStaticAssetKey(objectPath);
}

export function buildActivityCloudFileId(
  envId: string,
  assetKey: string,
  storageBucket?: string,
): string {
  const key = assetKey.trim();
  const env = envId.trim();
  const bucket = storageBucket?.trim();
  if (!key || !env) {
    return '';
  }
  if (bucket) {
    return `cloud://${env}.${bucket}/${key}`;
  }
  return `cloud://${env}/${key}`;
}

export function assertActivityStaticCloudFileIdForEnv(fileId: string): void {
  const trimmed = fileId.trim();
  if (!isActivityStaticCloudFileId(trimmed)) {
    throw new BadRequestException('活动封面资源无效');
  }
  const expectedEnv = process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
  if (!expectedEnv) {
    return;
  }
  const envSegment = trimmed.slice('cloud://'.length).split('/')[0] ?? '';
  if (!envSegment.startsWith(expectedEnv)) {
    throw new BadRequestException('活动封面资源无效');
  }
}
