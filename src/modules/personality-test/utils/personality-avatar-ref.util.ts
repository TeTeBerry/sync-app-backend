import { BadRequestException } from '@nestjs/common';
import {
  RAVER_AVATAR_ASSET_KEYS,
  RAVER_AVATAR_CLOUD_PREFIX,
} from '../data/personality-avatar-catalog';
import { buildPersonalityCloudFileId } from './personality-media-ref.util';

const CLOUD_FILE_ID_RE = /^cloud:\/\/[^/]+\/.+/;
const RAVER_AVATAR_KEY_SET = new Set<string>(RAVER_AVATAR_ASSET_KEYS);

export function isRaverAvatarAssetKey(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.includes('..')) {
    return false;
  }
  if (!trimmed.startsWith(RAVER_AVATAR_CLOUD_PREFIX)) {
    return false;
  }
  return RAVER_AVATAR_KEY_SET.has(trimmed);
}

export function isRaverAvatarCloudFileId(raw: string | undefined): boolean {
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
  return isRaverAvatarAssetKey(objectPath);
}

export function assertRaverAvatarCloudFileIdForEnv(fileId: string): void {
  const trimmed = fileId.trim();
  if (!isRaverAvatarCloudFileId(trimmed)) {
    throw new BadRequestException('头像资源无效');
  }
  const expectedEnv = process.env.CLOUDBASE_ENV_ID?.trim() ?? '';
  if (!expectedEnv) {
    return;
  }
  const envSegment = trimmed.slice('cloud://'.length).split('/')[0] ?? '';
  if (!envSegment.startsWith(expectedEnv)) {
    throw new BadRequestException('头像资源无效');
  }
}

export { buildPersonalityCloudFileId as buildRaverAvatarCloudFileId };
