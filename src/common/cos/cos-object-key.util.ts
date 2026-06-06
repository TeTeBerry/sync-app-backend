import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { extname } from 'path';

const SAFE_USER_ID_RE = /^[\w@.-]+$/;

export function assertSafeCosUploadUserId(userId: string): string {
  const safe = userId.trim();
  if (!safe) {
    throw new BadRequestException('请先登录');
  }
  if (!SAFE_USER_ID_RE.test(safe) || safe.includes('..')) {
    throw new BadRequestException('Invalid user id');
  }
  return safe;
}

export function buildCosPostImageObjectKey(
  userId: string,
  ext: string,
): string {
  const safeUserId = assertSafeCosUploadUserId(userId);
  const normalizedExt = ext.startsWith('.')
    ? ext.toLowerCase()
    : `.${ext.toLowerCase()}`;
  const suffix = ['.jpg', '.jpeg', '.png', '.webp'].includes(normalizedExt)
    ? normalizedExt === '.jpeg'
      ? '.jpg'
      : normalizedExt
    : '.jpg';
  const token = randomBytes(4).toString('hex');
  return `uploads/posts/${safeUserId}/${Date.now()}_${token}${suffix}`;
}

export function mimeToCosExtension(
  mime: string,
  originalname?: string,
): string {
  const fromName = extname(originalname || '').toLowerCase();
  if (fromName) return fromName;
  const normalized = mime.toLowerCase();
  if (normalized === 'image/png') return '.png';
  if (normalized === 'image/webp') return '.webp';
  return '.jpg';
}
