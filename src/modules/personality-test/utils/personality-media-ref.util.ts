import { BadRequestException } from '@nestjs/common';

const CLOUD_FILE_ID_RE = /^cloud:\/\/[^/]+\/.+/;
export const PERSONALITY_STATIC_MEDIA_PREFIX = 'static/personality-test/';

export function isPersonalityStaticAssetKey(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.includes('..')) {
    return false;
  }
  return trimmed.startsWith(PERSONALITY_STATIC_MEDIA_PREFIX);
}

export function buildPersonalityCloudFileId(
  envId: string,
  assetKey: string,
): string {
  const key = assetKey.trim();
  const env = envId.trim();
  if (!key || !env) {
    return '';
  }
  return `cloud://${env}/${key}`;
}

export function isPersonalityStaticCloudFileId(
  raw: string | undefined,
): boolean {
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
  return isPersonalityStaticAssetKey(objectPath);
}

export function assertPersonalityStaticCloudFileIdForEnv(fileId: string): void {
  const trimmed = fileId.trim();
  if (!isPersonalityStaticCloudFileId(trimmed)) {
    throw new BadRequestException('媒体资源无效');
  }
  const expectedEnv = process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
  if (!expectedEnv) {
    return;
  }
  const envSegment = trimmed.slice('cloud://'.length).split('/')[0] ?? '';
  if (!envSegment.startsWith(expectedEnv)) {
    throw new BadRequestException('媒体资源无效');
  }
}
