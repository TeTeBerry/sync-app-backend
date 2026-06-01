import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { UserService, UserMeDto } from '../user/user.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../user/interfaces/user.repository.interface';
import { AUTH_SESSION_EXPIRED_MESSAGE } from '../../common/auth/jwt-bearer.util';
import { WechatMiniService } from './wechat-mini.service';

export interface AuthTokenPayload {
  sub: string;
  name: string;
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
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  isDevLoginEnabled(): boolean {
    const mode = this.config.get<string>('auth.mode', 'wechat');
    if (mode === 'dev' || mode.includes('dev')) return true;
    return process.env.NODE_ENV !== 'production';
  }

  signToken(externalId: string, name: string): string {
    const payload: AuthTokenPayload = { sub: externalId, name };
    return this.jwtService.sign(payload);
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
    const user = await this.userService.getMe(uid, authorName);
    return {
      accessToken: this.signToken(user.id, user.name),
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
  ): Promise<AuthLoginResult> {
    const session = await this.wechatMini.exchangeCode(code);
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
