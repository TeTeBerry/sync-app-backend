import { BadRequestException } from '@nestjs/common';
import {
  resolveCosBucket,
  resolveCosPublicBaseUrl,
  resolveCosPublicHost,
  resolveCosRegion,
} from './cos-config.util';

function isCosBucketHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === resolveCosPublicHost().toLowerCase()) {
    return true;
  }
  const bucket = resolveCosBucket();
  const region = resolveCosRegion();
  return host === `${bucket}.cos.${region}.myqcloud.com`.toLowerCase();
}

export function parseCosObjectKeyFromUrl(imageUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl.trim());
  } catch {
    throw new BadRequestException('无效的图片地址');
  }

  if (!isCosBucketHostname(parsed.hostname)) {
    throw new BadRequestException('图片地址无效，请重新上传');
  }

  let key = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const bucket = resolveCosBucket();
  if (
    parsed.hostname.toLowerCase().startsWith('cos.') &&
    key.startsWith(`${bucket}/`)
  ) {
    key = key.slice(bucket.length + 1);
  }

  if (!key || key.includes('..')) {
    throw new BadRequestException('图片地址无效，请重新上传');
  }

  return key;
}

export function normalizeCosPostImageUrl(imageUrl: string): string {
  const key = parseCosObjectKeyFromUrl(imageUrl);
  return `${resolveCosPublicBaseUrl()}/${key}`;
}

export function assertCosPostImageUrlForUser(
  imageUrl: string,
  userId: string,
): string {
  const key = parseCosObjectKeyFromUrl(imageUrl);
  const safeUserId = userId.trim();
  if (!safeUserId) {
    throw new BadRequestException('请先登录');
  }

  const expectedPrefix = `uploads/posts/${safeUserId}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new BadRequestException('图片地址无效，请重新上传');
  }

  return key;
}
