import { BadRequestException } from '@nestjs/common';

const CLOUD_FILE_ID_RE = /^cloud:\/\/[^/]+\/.+/;

export const LINEUP_AVATAR_CLOUD_PREFIX = 'lineup-avatar/';

const DISCOGS_AVATAR_HOST_RE = /(^|\.)discogs\.com/i;

export function isDiscogsAvatarUrl(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return false;
  }
  try {
    return DISCOGS_AVATAR_HOST_RE.test(new URL(trimmed).hostname);
  } catch {
    return DISCOGS_AVATAR_HOST_RE.test(trimmed);
  }
}

export function isRemoteLineupAvatarUrl(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  return Boolean(trimmed && /^https?:\/\//i.test(trimmed));
}

/** Public HTTPS avatar URL safe to expose in catalog (excludes unstable Discogs links). */
export function isUsableLineupAvatarUrl(
  raw: string | undefined,
  source?: string | null,
): boolean {
  if (source?.trim().toLowerCase() === 'discogs') {
    return false;
  }
  return isRemoteLineupAvatarUrl(raw) && !isDiscogsAvatarUrl(raw);
}

export function isLineupAvatarAssetKey(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.includes('..')) {
    return false;
  }
  return trimmed.startsWith(LINEUP_AVATAR_CLOUD_PREFIX);
}

export function isLineupAvatarCloudFileId(raw: string | undefined): boolean {
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
  return isLineupAvatarAssetKey(objectPath);
}

export function buildLineupAvatarCloudFileId(
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

export function assertLineupAvatarCloudFileIdForEnv(fileId: string): void {
  const trimmed = fileId.trim();
  if (!isLineupAvatarCloudFileId(trimmed)) {
    throw new BadRequestException('阵容艺人头像资源无效');
  }
  const expectedEnv = process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
  if (!expectedEnv) {
    return;
  }
  const envSegment = trimmed.slice('cloud://'.length).split('/')[0] ?? '';
  if (!envSegment.startsWith(expectedEnv)) {
    throw new BadRequestException('阵容艺人头像资源无效');
  }
}
