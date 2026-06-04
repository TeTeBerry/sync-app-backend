import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { toRequestActor } from '../../common/auth/actor-query.util';
import { UserService, UserMeDto } from '../user/user.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../user/interfaces/user.repository.interface';
import {
  AUTH_SESSION_EXPIRED_MESSAGE,
  classifyBearerAuth,
  extractBearerToken,
  type ClassifyBearerAuthResult,
} from '../../common/auth/jwt-bearer.util';
import { WechatMiniService } from './wechat-mini.service';
import { WechatUserRiskService } from './wechat-user-risk.service';
import type { RequestActor } from '../../common/auth/request-actor.types';

export interface AuthTokenPayload {
  sub: string;
  name: string;
  /** Session version; bumped on logout to revoke older JWTs. */
  tv?: number;
}

export interface AuthLoginResult {
  accessToken: string;
  user: UserMeDto;
}

const DEFAULT_WECHAT_NAME = '微信用户';

export type WechatProfileInput = {
  nickName?: string;
  avatarUrl?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly wechatMini: WechatMiniService,
    private readonly wechatUserRisk: WechatUserRiskService,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  /**
   * Ensures WeChat users pass `getuserriskrank` before using the app (login + periodic recheck).
   */
  async assertActorAllowedToUseApp(
    actor: RequestActor,
    clientIp: string,
  ): Promise<void> {
    if (actor.source !== 'jwt') {
      return;
    }

    const user = await this.users.findByExternalId(actor.resolvedUserId);
    if (!user) {
      return;
    }

    const openid = user.openid?.trim();
    if (!openid) {
      return;
    }

    if (!this.wechatUserRisk.isEnabled()) {
      return;
    }

    let rank = user.wechatRiskRank;
    if (
      rank == null ||
      this.wechatUserRisk.shouldRefreshStoredRank(user.wechatRiskCheckedAt)
    ) {
      rank = await this.wechatUserRisk.fetchAndAssertRiskRank({
        openid,
        clientIp,
      });
      await this.users.updateByExternalId(actor.resolvedUserId, {
        wechatRiskRank: rank,
        wechatRiskCheckedAt: new Date(),
      });
      return;
    }

    this.wechatUserRisk.assertRankAllowed(rank);
  }

  isDevLoginEnabled(): boolean {
    const mode = this.config.get<string>('auth.mode', 'wechat');
    if (mode === 'dev' || mode.includes('dev')) return true;
    return process.env.NODE_ENV !== 'production';
  }

  signToken(externalId: string, name: string, tokenVersion = 0): string {
    const payload: AuthTokenPayload = {
      sub: externalId,
      name,
      tv: tokenVersion,
    };
    return this.jwtService.sign(payload);
  }

  async resolveBearerAuth(
    authorization?: string | string[],
  ): Promise<ClassifyBearerAuthResult> {
    const auth = classifyBearerAuth(this.jwtService, authorization);
    if (auth.kind !== 'valid') {
      return auth;
    }

    const token = extractBearerToken(authorization);
    if (!token) {
      return { kind: 'invalid' };
    }

    let payload: AuthTokenPayload;
    try {
      payload = this.jwtService.verify<AuthTokenPayload>(token);
    } catch {
      return { kind: 'invalid' };
    }

    const current = await this.users.getTokenVersion(payload.sub);
    const issued = payload.tv ?? 0;
    if (issued !== current) {
      return { kind: 'invalid' };
    }

    return auth;
  }

  async logout(actor: { source: string; resolvedUserId: string }): Promise<{
    ok: true;
  }> {
    if (actor.source === 'jwt') {
      await this.users.incrementTokenVersion(actor.resolvedUserId);
    }
    return { ok: true };
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return this.jwtService.verify<AuthTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(AUTH_SESSION_EXPIRED_MESSAGE);
    }
  }

  extractBearerToken(authorization?: string): string | null {
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
  }

  private async buildLoginResult(
    externalId: string,
    authorName?: string,
  ): Promise<AuthLoginResult> {
    const uid = externalId?.trim();
    if (!uid) {
      throw new UnauthorizedException('用户资料无效');
    }
    const user = await this.userService.getMe(toRequestActor(uid, authorName));
    const tokenVersion = await this.users.getTokenVersion(user.id);
    return {
      accessToken: this.signToken(user.id, user.name, tokenVersion),
      user,
    };
  }

  private resolveWechatName(
    profile: WechatProfileInput | undefined,
    existingName?: string,
  ): string {
    const wxName = profile?.nickName?.trim();
    if (wxName) return wxName.slice(0, 64);
    const saved = existingName?.trim();
    if (saved) return saved;
    return DEFAULT_WECHAT_NAME;
  }

  private resolveWechatAvatar(
    profile: WechatProfileInput | undefined,
    existingAvatar?: string,
  ): string {
    const wxAvatar = profile?.avatarUrl?.trim();
    if (wxAvatar && /^https?:\/\//i.test(wxAvatar)) {
      return wxAvatar.slice(0, 2048);
    }
    return existingAvatar?.trim() ?? '';
  }

  private suggestHandleFromName(name: string, externalId: string): string {
    const slug = name.replace(/\s+/g, '').slice(0, 12);
    if (slug && name !== DEFAULT_WECHAT_NAME) {
      return `@${slug}`;
    }
    return `@${externalId.replace(/^wx_/, '').slice(0, 10)}`;
  }

  async loginWithWechatCode(
    code: string,
    profile?: WechatProfileInput,
    clientIp?: string,
  ): Promise<AuthLoginResult> {
    const session = await this.wechatMini.exchangeCode(code);
    const ip = clientIp?.trim() || '127.0.0.1';
    const riskRank = await this.wechatUserRisk.fetchAndAssertRiskRank({
      openid: session.openid,
      clientIp: ip,
    });
    const existing = await this.users.findByOpenid(session.openid);
    const name = this.resolveWechatName(profile, existing?.name);
    const avatar = this.resolveWechatAvatar(profile, existing?.avatar);
    const externalId = existing?.externalId ?? `wx_${session.openid}`;

    const record = await this.users.upsertWechatUser(session.openid, {
      unionid: session.unionid,
      name,
      handle: existing?.handle ?? this.suggestHandleFromName(name, externalId),
      location: existing?.location,
      bio: existing?.bio,
      avatar,
      notificationsEnabled: existing?.notificationsEnabled ?? true,
      privacyLevel: existing?.privacyLevel ?? 'public',
      wechatRiskRank: riskRank,
      wechatRiskCheckedAt: new Date(),
    });

    void this.userService.syncUserProfileVector(record, record.externalId);

    return this.buildLoginResult(record.externalId!, record.name);
  }

  async loginWithDev(displayName?: string): Promise<AuthLoginResult> {
    if (!this.isDevLoginEnabled()) {
      throw new ForbiddenException('开发登录未启用');
    }

    const name = displayName?.trim() || '开发用户';
    const externalId = `dev_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const record = await this.users.upsertByExternalId(externalId, {
      name,
      handle: `@${externalId.slice(0, 10)}`,
      location: '',
      bio: '',
      avatar: '',
      notificationsEnabled: true,
      privacyLevel: 'public',
    });

    return this.buildLoginResult(externalId, name);
  }
}
