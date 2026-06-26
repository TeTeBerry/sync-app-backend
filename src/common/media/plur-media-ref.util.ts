import { BadRequestException } from '@nestjs/common';

const CLOUD_FILE_ID_RE = /^cloud:\/\/[^/]+\/.+/;

export const PLUR_STATIC_MEDIA_PREFIX = 'static/plur/';

export function isPlurStaticAssetKey(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.includes('..')) {
    return false;
  }
  return trimmed.startsWith(PLUR_STATIC_MEDIA_PREFIX);
}

export function isPlurStaticCloudFileId(raw: string | undefined): boolean {
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
  return isPlurStaticAssetKey(objectPath);
}

export function assertPlurStaticCloudFileIdForEnv(fileId: string): void {
  const trimmed = fileId.trim();
  if (!isPlurStaticCloudFileId(trimmed)) {
    throw new BadRequestException('PLUR 媒体资源无效');
  }
  const expectedEnv = process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
  if (!expectedEnv) {
    return;
  }
  const envSegment = trimmed.slice('cloud://'.length).split('/')[0] ?? '';
  if (!envSegment.startsWith(expectedEnv)) {
    throw new BadRequestException('PLUR 媒体资源无效');
  }
}
