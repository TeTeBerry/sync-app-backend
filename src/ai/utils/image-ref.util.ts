import { BadRequestException, Logger } from '@nestjs/common';
import { URL } from 'url';
import {
  decodeBase64Payload,
  ImageTooLargeError,
  toDataUrl,
} from './image-base64.util';

const logger = new Logger('ImageRefUtil');

export { ImageTooLargeError };

function resolveUploadPublicBase(): string {
  const configured = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const port = process.env.PORT?.trim() || '3000';
  return `http://127.0.0.1:${port}`;
}

function isAllowedUploadUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (!pathname.includes('/uploads/')) {
    return false;
  }

  const allowedBase = resolveUploadPublicBase();
  try {
    const allowed = new URL(allowedBase);
    if (parsed.hostname === allowed.hostname && parsed.port === allowed.port) {
      return true;
    }
  } catch {
    // ignore
  }

  if (
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost'
  ) {
    return true;
  }

  return false;
}

async function fetchUploadAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new BadRequestException('无法读取上传的图片');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  decodeBase64Payload(
    `data:image/jpeg;base64,${buffer.toString('base64')}`,
  );

  const contentType =
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new BadRequestException('仅支持图片文件');
  }

  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

/**
 * Validates image ref (data URL or uploads URL) and returns a data URL for VL APIs.
 */
export async function resolveImageInput(ref: string): Promise<string> {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error('图片数据为空');
  }

  if (/^data:/i.test(trimmed)) {
    const { mimeType, base64 } = decodeBase64Payload(trimmed);
    return toDataUrl(mimeType, base64);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (!isAllowedUploadUrl(trimmed)) {
      logger.warn(`Rejected image URL host/path: ${trimmed}`);
      throw new BadRequestException('图片地址无效');
    }
    return fetchUploadAsDataUrl(trimmed);
  }

  throw new BadRequestException('图片格式无效');
}

/** Sync validation for incoming WS payloads (size check for data URLs only). */
export function validateImageRefSync(ref: string): void {
  const trimmed = ref.trim();
  if (!trimmed) {
    throw new Error('图片数据为空');
  }

  if (/^data:/i.test(trimmed)) {
    decodeBase64Payload(trimmed);
    return;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (!isAllowedUploadUrl(trimmed)) {
      throw new BadRequestException('图片地址无效');
    }
    return;
  }

  throw new BadRequestException('图片格式无效');
}
