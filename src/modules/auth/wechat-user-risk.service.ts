import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatAccessTokenService } from './wechat-access-token.service';

/** WeChat scene: 2 = UGC. @see https://developers.weixin.qq.com/miniprogram/dev/server/API/sec-center/safety-control-capability/api_getuserriskrank.html */
export const WECHAT_USER_RISK_SCENE_UGC = 2;

export const WECHAT_USER_RISK_BLOCKED_MESSAGE =
  '当前账号安全风险较高，暂无法使用本小程序';

interface GetUserRiskRankResponse {
  errcode?: number;
  errmsg?: string;
  risk_rank?: number;
}

@Injectable()
export class WechatUserRiskService {
  private readonly logger = new Logger(WechatUserRiskService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly accessToken: WechatAccessTokenService,
  ) {}

  isEnabled(): boolean {
    if (this.config.get<boolean>('auth.wechatMini.userRiskEnabled') !== true) {
      return false;
    }
    return this.accessToken.isConfigured();
  }

  maxAllowedRank(): number {
    const raw = this.config.get<number>('auth.wechatMini.userRiskMaxRank');
    return Number.isFinite(raw) ? (raw as number) : 2;
  }

  recheckIntervalMs(): number {
    const hours = this.config.get<number>(
      'auth.wechatMini.userRiskRecheckHours',
    );
    const h = Number.isFinite(hours) ? (hours as number) : 24;
    return Math.max(1, h) * 60 * 60 * 1000;
  }

  shouldRefreshStoredRank(checkedAt?: Date | string | null): boolean {
    if (!checkedAt) return true;
    const ts = new Date(checkedAt).getTime();
    if (Number.isNaN(ts)) return true;
    return Date.now() - ts >= this.recheckIntervalMs();
  }

  assertRankAllowed(riskRank: number): void {
    if (riskRank <= this.maxAllowedRank()) {
      return;
    }
    throw new ForbiddenException(WECHAT_USER_RISK_BLOCKED_MESSAGE);
  }

  /**
   * Calls `wxa/getuserriskrank` and returns `risk_rank` (0–4, higher = riskier).
   */
  async fetchRiskRank(params: {
    openid: string;
    clientIp: string;
    scene?: number;
  }): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }

    const openid = params.openid.trim();
    const clientIp = params.clientIp.trim() || '127.0.0.1';
    const appId = this.config.get<string>('auth.wechatMini.appId', '');
    if (!appId) {
      throw new ServiceUnavailableException('未配置小程序 AppId');
    }

    const token = await this.accessToken.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/getuserriskrank?access_token=${encodeURIComponent(token)}`;

    const body = {
      appid: appId,
      openid,
      scene: params.scene ?? WECHAT_USER_RISK_SCENE_UGC,
      client_ip: clientIp,
    };

    let payload: GetUserRiskRankResponse;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      payload = (await res.json()) as GetUserRiskRankResponse;
    } catch (error) {
      this.logger.warn(
        `WeChat getuserriskrank failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException(
        '用户安全等级检测暂不可用，请稍后重试',
      );
    }

    if (payload.errcode === 0 && typeof payload.risk_rank === 'number') {
      return payload.risk_rank;
    }

    if (payload.errcode === 61080) {
      throw new ServiceUnavailableException(
        '用户安全等级服务暂不可用，请稍后重试',
      );
    }

    if (payload.errcode === 61081) {
      throw new ServiceUnavailableException(
        '用户安全等级检测过于频繁，请稍后再试',
      );
    }

    this.logger.warn(
      `WeChat getuserriskrank unexpected errcode=${payload.errcode} errmsg=${payload.errmsg ?? ''}`,
    );
    throw new ServiceUnavailableException(
      payload.errmsg || '用户安全等级检测失败，请稍后重试',
    );
  }

  async fetchAndAssertRiskRank(params: {
    openid: string;
    clientIp: string;
    scene?: number;
  }): Promise<number> {
    const rank = await this.fetchRiskRank(params);
    this.assertRankAllowed(rank);
    return rank;
  }
}
