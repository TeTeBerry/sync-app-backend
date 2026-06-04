import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chunkTextForWechatSecCheck } from '../../common/media/user-text-chunk.util';
import { WechatAccessTokenService } from './wechat-access-token.service';

/** WeChat `img_sec_check` media size limit. */
export const WECHAT_IMG_SEC_CHECK_MAX_BYTES = 1024 * 1024;

interface WechatSecCheckResponse {
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
   * Synchronous text moderation via WeChat `wxa/msg_sec_check`.
   * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/msgSecCheck.html
   */
  async assertTextSafe(content: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const token = await this.accessToken.getAccessToken();

    for (const chunk of chunkTextForWechatSecCheck(trimmed)) {
      await this.postMsgSecCheck(token, chunk);
    }
  }

  /** Check multiple user text fields (skips empty). */
  async assertTextsSafe(
    texts: Array<string | undefined | null>,
  ): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    for (const raw of texts) {
      const trimmed = raw?.trim();
      if (!trimmed) continue;
      await this.assertTextSafe(trimmed);
    }
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

    let payload: WechatSecCheckResponse;
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
      });
      payload = (await res.json()) as WechatSecCheckResponse;
    } catch (error) {
      this.logger.warn(
        `WeChat img_sec_check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('图片安全检测暂不可用，请稍后重试');
    }

    this.handleSecCheckResponse(payload, {
      riskyMessage: '图片含有违规内容，请更换后重试',
      formatMessage: '图片格式或尺寸不符合要求，请更换 JPEG/PNG 后重试',
      busyMessage: '图片安全检测繁忙，请稍后再试',
      fallbackMessage: '图片安全检测失败，请稍后重试',
      logLabel: 'img_sec_check',
    });
  }

  private async postMsgSecCheck(token: string, content: string): Promise<void> {
    const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(token)}`;

    let payload: WechatSecCheckResponse;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      payload = (await res.json()) as WechatSecCheckResponse;
    } catch (error) {
      this.logger.warn(
        `WeChat msg_sec_check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('文本安全检测暂不可用，请稍后重试');
    }

    this.handleSecCheckResponse(payload, {
      riskyMessage: '文本含有违规内容，请修改后重试',
      formatMessage: '文本格式不符合要求，请修改后重试',
      busyMessage: '文本安全检测繁忙，请稍后再试',
      fallbackMessage: '文本安全检测失败，请稍后重试',
      logLabel: 'msg_sec_check',
    });
  }

  private handleSecCheckResponse(
    payload: WechatSecCheckResponse,
    messages: {
      riskyMessage: string;
      formatMessage: string;
      busyMessage: string;
      fallbackMessage: string;
      logLabel: string;
    },
  ): void {
    if (payload.errcode === 0) {
      return;
    }

    if (payload.errcode === 87014) {
      throw new BadRequestException(messages.riskyMessage);
    }

    if (payload.errcode === 40006) {
      throw new BadRequestException(messages.formatMessage);
    }

    if (payload.errcode === 44991 || payload.errcode === 45009) {
      throw new ServiceUnavailableException(messages.busyMessage);
    }

    this.logger.warn(
      `WeChat ${messages.logLabel} unexpected errcode=${payload.errcode} errmsg=${payload.errmsg ?? ''}`,
    );
    throw new ServiceUnavailableException(
      payload.errmsg || messages.fallbackMessage,
    );
  }
}
