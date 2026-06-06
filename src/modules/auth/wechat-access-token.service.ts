import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatAccessTokenService {
  private readonly logger = new Logger(WechatAccessTokenService.name);
  private cached: { token: string; expiresAtMs: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get credentials(): { appId: string; appSecret: string } {
    return {
      appId: this.config.get<string>('auth.wechatMini.appId', ''),
      appSecret: this.config.get<string>('auth.wechatMini.appSecret', ''),
    };
  }

  isConfigured(): boolean {
    const { appId, appSecret } = this.credentials;
    return Boolean(appId && appSecret);
  }

  async getAccessToken(): Promise<string> {
    const { appId, appSecret } = this.credentials;
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException(
        '未配置 WECHAT_MINI_APP_ID / WECHAT_MINI_APP_SECRET',
      );
    }

    const now = Date.now();
    if (this.cached && now < this.cached.expiresAtMs - 60_000) {
      return this.cached.token;
    }

    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);

    let payload: WechatTokenResponse;
    try {
      const res = await fetch(url.toString());
      payload = (await res.json()) as WechatTokenResponse;
    } catch (error) {
      this.logger.warn(
        `WeChat access_token fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('微信服务暂不可用');
    }

    if (payload.errcode && payload.errcode !== 0) {
      if (payload.errcode === 40125) {
        throw new ServiceUnavailableException(
          '微信小程序 AppSecret 无效，请在微信公众平台核对 WECHAT_MINI_APP_SECRET',
        );
      }
      if (payload.errcode === 40013) {
        throw new ServiceUnavailableException(
          '微信小程序 AppId 无效，请检查 WECHAT_MINI_APP_ID 配置',
        );
      }
      throw new ServiceUnavailableException(
        payload.errmsg || `获取微信 access_token 失败 (${payload.errcode})`,
      );
    }

    if (!payload.access_token) {
      throw new ServiceUnavailableException('微信 access_token 响应无效');
    }

    const ttlSec = payload.expires_in ?? 7200;
    this.cached = {
      token: payload.access_token,
      expiresAtMs: now + ttlSec * 1000,
    };
    return payload.access_token;
  }

  /** Test helper */
  clearCache(): void {
    this.cached = null;
  }
}
