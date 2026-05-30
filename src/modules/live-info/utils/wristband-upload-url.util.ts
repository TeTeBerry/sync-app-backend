import { BadRequestException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';

function resolveUploadDir(): string {
  return process.env.UPLOAD_DIR?.trim() || './uploads';
}

function resolvePublicBaseUrls(): string[] {
  const configured = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
  const port = process.env.PORT?.trim() || '3000';
  const bases = new Set<string>();
  if (configured) {
    bases.add(configured.replace(/\/$/, ''));
  }
  bases.add(`http://127.0.0.1:${port}`);
  bases.add(`http://localhost:${port}`);
  return [...bases];
}

/** 仅允许本服务 /uploads 下、来源在白名单内的图片 URL。 */
export function assertAllowedUploadImageUrl(imageUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl.trim());
  } catch {
    throw new BadRequestException('无效的图片地址');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('图片地址须为 http(s) URL');
  }
  const pathname = decodeURIComponent(parsed.pathname);
  if (!pathname.startsWith('/uploads/') || pathname.includes('..')) {
    throw new BadRequestException('请使用本站上传接口返回的图片地址');
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  const allowed = resolvePublicBaseUrls();
  if (!allowed.some((base) => origin === base)) {
    throw new BadRequestException('图片地址不在允许的来源内');
  }
}

export function readUploadImageAsDataUrl(imageUrl: string): string {
  assertAllowedUploadImageUrl(imageUrl);
  const pathname = decodeURIComponent(new URL(imageUrl.trim()).pathname);
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
