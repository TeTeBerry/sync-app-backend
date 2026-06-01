import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WechatCode2SessionResult {
  openid: string;
  sessionKey: string;
  unionid?: string;
}

interface WechatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatMiniService {
  constructor(private readonly config: ConfigService) {}

  private get credentials(): { appId: string; appSecret: string } {
    const appId = this.config.get<string>('auth.wechatMini.appId', '');
    const appSecret = this.config.get<string>('auth.wechatMini.appSecret', '');
    return { appId, appSecret };
  }

  async exchangeCode(code: string): Promise<WechatCode2SessionResult> {
    const trimmed = code?.trim();
    if (!trimmed) {
      throw new BadRequestException('微信登录 code 不能为空');
    }

    const { appId, appSecret } = this.credentials;
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException(
        '未配置 WECHAT_MINI_APP_ID / WECHAT_MINI_APP_SECRET',
      );
    }

    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);
    url.searchParams.set('js_code', trimmed);
    url.searchParams.set('grant_type', 'authorization_code');

    let payload: WechatCode2SessionResponse;
    try {
      const res = await fetch(url.toString());
      payload = (await res.json()) as WechatCode2SessionResponse;
    } catch {
      throw new ServiceUnavailableException('微信登录服务暂不可用');
    }

    if (payload.errcode && payload.errcode !== 0) {
      throw new BadRequestException(
        payload.errmsg || `微信登录失败 (${payload.errcode})`,
      );
    }

    if (!payload.openid || !payload.session_key) {
      throw new BadRequestException('微信登录响应无效');
    }

    return {
      openid: payload.openid,
      sessionKey: payload.session_key,
      unionid: payload.unionid,
    };
  }
}
