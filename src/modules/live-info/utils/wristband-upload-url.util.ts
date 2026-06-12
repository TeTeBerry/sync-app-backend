import { BadRequestException } from '@nestjs/common';
import { basename, extname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import {
  assertUserImageRefSync,
  isAllowedUserUploadImageRef,
  isCloudStorageFileId,
} from '../../../common/media/user-image-ref.util';

function resolveUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || './uploads';
}

/** Allowed CloudBase fileID or legacy backend `/uploads/` URLs. */
export function assertAllowedUploadImageUrl(imageUrl: string): void {
  const trimmed = imageUrl.trim();
  if (!isAllowedUserUploadImageRef(trimmed)) {
    throw new BadRequestException('请使用本站上传接口返回的图片地址');
  }
}

export function isCloudWristbandImageRef(imageUrl: string): boolean {
  return isCloudStorageFileId(imageUrl);
}

export async function readUploadImageAsDataUrl(
  imageUrl: string,
): Promise<string> {
  assertAllowedUploadImageUrl(imageUrl);
  const trimmed = imageUrl.trim();

  if (isCloudStorageFileId(trimmed)) {
    throw new BadRequestException('云存储图片请在客户端上传后提交 fileID');
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
