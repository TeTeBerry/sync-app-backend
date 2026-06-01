import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatAccessTokenService } from './wechat-access-token.service';

/** WeChat `img_sec_check` media size limit. */
export const WECHAT_IMG_SEC_CHECK_MAX_BYTES = 1024 * 1024;

interface WechatImgSecCheckResponse {
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatContentSecurityService {
  private readonly logger = new Logger(WechatContentSecurityService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly accessToken: WechatAccessTokenService,
  ) {}

  isEnabled(): boolean {
    if (
      this.config.get<boolean>('auth.wechatMini.contentSecurityEnabled') !==
      true
    ) {
      return false;
    }
    return this.accessToken.isConfigured();
  }

  /**
   * Synchronous image moderation via WeChat `wxa/img_sec_check`.
   * @see https://developers.weixin.qq.com/miniprogram/dev/framework/security.imgSecCheck.html
   */
  async assertImageSafe(params: {
    buffer: Buffer;
    mime: string;
    size: number;
  }): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (params.size > WECHAT_IMG_SEC_CHECK_MAX_BYTES) {
      throw new BadRequestException('图片不能超过 1MB（微信内容安全检测限制）');
    }

    const mime = params.mime?.toLowerCase() || 'image/jpeg';
    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';

    const token = await this.accessToken.getAccessToken();
    const form = new FormData();
    form.append(
      'media',
      new Blob([new Uint8Array(params.buffer)], { type: mime }),
      `upload.${ext}`,
    );

    const url = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${encodeURIComponent(token)}`;

    let payload: WechatImgSecCheckResponse;
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
      });
      payload = (await res.json()) as WechatImgSecCheckResponse;
    } catch (error) {
      this.logger.warn(
        `WeChat img_sec_check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('图片安全检测暂不可用，请稍后重试');
    }

    if (payload.errcode === 0) {
      return;
    }

    if (payload.errcode === 87014) {
      throw new BadRequestException('图片含有违规内容，请更换后重试');
    }

    if (payload.errcode === 40006) {
      throw new BadRequestException(
        '图片格式或尺寸不符合要求，请更换 JPEG/PNG 后重试',
      );
    }

    if (payload.errcode === 44991 || payload.errcode === 45009) {
      throw new ServiceUnavailableException('图片安全检测繁忙，请稍后再试');
    }

    this.logger.warn(
      `WeChat img_sec_check unexpected errcode=${payload.errcode} errmsg=${payload.errmsg ?? ''}`,
    );
    throw new ServiceUnavailableException(
      payload.errmsg || '图片安全检测失败，请稍后重试',
    );
  }
}
