import { BadRequestException } from '@nestjs/common';
import { basename, extname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import {
  assertUserImageRefSync,
  isAllowedUserUploadImageUrl,
} from '../../../common/media/user-image-ref.util';
import { resolveCosPublicHost } from '../../../common/cos/cos-config.util';

function resolveUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || './uploads';
}

function isCosUploadImageUrl(imageUrl: string): boolean {
  try {
    return new URL(imageUrl.trim()).hostname === resolveCosPublicHost();
  } catch {
    return false;
  }
}

/** Allowed upload API / COS URLs for wristband images. */
export function assertAllowedUploadImageUrl(imageUrl: string): void {
  const trimmed = imageUrl.trim();
  if (!isAllowedUserUploadImageUrl(trimmed)) {
    throw new BadRequestException('请使用本站上传接口返回的图片地址');
  }
}

export async function readUploadImageAsDataUrl(
  imageUrl: string,
): Promise<string> {
  assertAllowedUploadImageUrl(imageUrl);
  const trimmed = imageUrl.trim();

  if (isCosUploadImageUrl(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new BadRequestException('无法读取上传的图片，请重新上传');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mime =
      response.headers
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase() || inferMimeFromUrl(trimmed);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  assertUserImageRefSync(trimmed);
  const pathname = decodeURIComponent(new URL(trimmed).pathname);
  const filename = basename(pathname);
  if (!filename || filename === '.' || filename === '..') {
    throw new BadRequestException('无效的图片路径');
  }

  const filePath = join(resolveUploadDir(), filename);
  if (!existsSync(filePath)) {
    throw new BadRequestException('图片文件不存在或已过期，请重新上传');
  }

  const buffer = readFileSync(filePath);
  const ext = extname(filename).toLowerCase();
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/jpeg';

  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function inferMimeFromUrl(imageUrl: string): string {
  const lower = imageUrl.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}
