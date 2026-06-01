import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import {
  WechatContentSecurityService,
  WECHAT_IMG_SEC_CHECK_MAX_BYTES,
} from '../auth/wechat-content-security.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype?: string;
  size: number;
  originalname?: string;
};

@Injectable()
export class UploadService {
  constructor(
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {}

  private resolveUploadDir(): string {
    const dir = process.env.UPLOAD_DIR?.trim() || './uploads';
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private resolvePublicBaseUrl(): string {
    const configured = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }
    const port = process.env.PORT?.trim() || '3000';
    return `http://127.0.0.1:${port}`;
  }

  async saveImageFile(file: UploadedImageFile): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('未收到图片文件');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('图片不能超过 2MB');
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('仅支持 JPEG、PNG、WebP 图片');
    }

    if (
      this.wechatContentSecurity.isEnabled() &&
      file.size > WECHAT_IMG_SEC_CHECK_MAX_BYTES
    ) {
      throw new BadRequestException('图片不能超过 1MB（微信内容安全检测限制）');
    }

    await this.wechatContentSecurity.assertImageSafe({
      buffer: file.buffer,
      mime,
      size: file.size,
    });

    const ext =
      extname(file.originalname || '').toLowerCase() ||
      (mime === 'image/png'
        ? '.png'
        : mime === 'image/webp'
          ? '.webp'
          : '.jpg');
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const dir = this.resolveUploadDir();
    writeFileSync(join(dir, filename), file.buffer);

    const publicBase = this.resolvePublicBaseUrl();
    return { url: `${publicBase}/uploads/${filename}` };
  }
}
