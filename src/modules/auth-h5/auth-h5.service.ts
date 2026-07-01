import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthLoginResult } from '@sync/profile-contracts';
import { RedisService } from '../../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import { UserService } from '../user/user.service';
import {
  IUserRepository,
  USER_REPOSITORY,
  type UserRecord,
} from '../user/interfaces/user.repository.interface';
import { toRequestActor } from '../../common/auth/actor-query.util';
import { generatePersonalityRaverAvatarKey } from '../personality-test/utils/personality-raver-avatar.util';

const SMS_CODE_PREFIX = 'sms:code:';
const SMS_RATE_PREFIX = 'sms:rate:';
const SMS_CODE_TTL_SEC = 300;
const SMS_RATE_WINDOW_SEC = 60;
const SMS_RATE_MAX = 1;

@Injectable()
export class AuthH5Service {
  private readonly logger = new Logger(AuthH5Service.name);

  // In-memory fallback when Redis is unavailable
  private readonly codeStore = new Map<
    string,
    { code: string; expiresAt: number }
  >();
  private readonly rateStore = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly smsService: SmsService,
    private readonly userService: UserService,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private normalizePhone(phone: string): string {
    return phone.trim().replace(/^\+86/, '');
  }

  async sendSmsCode(phone: string): Promise<{ ok: boolean }> {
    const normalized = this.normalizePhone(phone);

    if (!/^1[3-9]\d{9}$/.test(normalized)) {
      throw new BadRequestException('请输入正确的手机号');
    }

    // Rate limit
    const rateKey = `${SMS_RATE_PREFIX}${normalized}`;
    const allowed = await this.checkRateLimit(rateKey);
    if (!allowed) {
      throw new HttpException('发送过于频繁，请 60 秒后再试', 429);
    }

    const code = this.generateCode();
    const codeKey = `${SMS_CODE_PREFIX}${normalized}`;

    // Store code
    await this.storeCode(codeKey, code);

    // Send SMS (skipped in dev mode — code is logged instead)
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      this.logger.warn(
        `[DEV] SMS skipped. Verification code for ${normalized}: ${code}`,
      );
    } else {
      await this.smsService.sendVerificationCode(normalized, code);
      this.logger.log(`SMS code sent to ${normalized}`);
    }
    return { ok: true };
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    const normalized = this.normalizePhone(phone);
    const codeKey = `${SMS_CODE_PREFIX}${normalized}`;
    const stored = await this.getCode(codeKey);

    if (!stored || stored !== code) {
      return false;
    }

    // One-time use: delete on successful match
    await this.deleteCode(codeKey);
    return true;
  }

  async loginWithPhone(phone: string, code: string): Promise<AuthLoginResult> {
    const normalized = this.normalizePhone(phone);

    if (!/^1[3-9]\d{9}$/.test(normalized)) {
      throw new BadRequestException('请输入正确的手机号');
    }

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new BadRequestException('验证码格式错误');
    }

    // Dev mode: any 6-digit code passes (no SMS cost)
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev) {
      const valid = await this.verifyCode(normalized, code);
      if (!valid) {
        throw new UnauthorizedException('验证码错误或已过期');
      }
    }

    const externalId = `phone_${normalized}`;
    const existing = await this.users.findByExternalId(externalId);

    const defaultName = `手机用户${normalized.slice(-4)}`;
    const defaultHandle = `@phone${normalized.slice(-4)}`;

    const record = await this.users.upsertByExternalId(externalId, {
      name: existing?.name?.trim() || defaultName,
      handle: existing?.handle ?? defaultHandle,
      location: existing?.location,
      bio: existing?.bio,
      avatar: existing?.avatar?.trim() || generatePersonalityRaverAvatarKey(),
      notificationsEnabled: existing?.notificationsEnabled ?? true,
      privacyLevel: existing?.privacyLevel ?? 'public',
    });

    const uid = record.externalId?.trim();
    if (!uid) {
      throw new UnauthorizedException('用户创建失败');
    }
    return this.buildLoginResult(uid, record.name ?? defaultName);
  }

  private async buildLoginResult(
    externalId: string,
    name: string,
  ): Promise<AuthLoginResult> {
    const uid = externalId?.trim();
    if (!uid) {
      throw new UnauthorizedException('用户资料无效');
    }
    const user = await this.userService.getMe(toRequestActor(uid, name));
    const tokenVersion = await this.users.getTokenVersion(user.id);
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        name: user.name,
        tv: tokenVersion,
      }),
      user,
    };
  }

  // ── Redis + memory fallback ──────────────────────────────

  private async storeCode(key: string, code: string): Promise<void> {
    if (this.redis.isEnabled()) {
      await this.redis.setCacheValueEx(key, code, SMS_CODE_TTL_SEC);
      return;
    }
    this.codeStore.set(key, {
      code,
      expiresAt: Date.now() + SMS_CODE_TTL_SEC * 1000,
    });
  }

  private async getCode(key: string): Promise<string | null> {
    if (this.redis.isEnabled()) {
      return (await this.redis.getCacheValue(key)) ?? null;
    }
    const entry = this.codeStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.codeStore.delete(key);
      return null;
    }
    return entry.code;
  }

  private async deleteCode(key: string): Promise<void> {
    if (this.redis.isEnabled()) {
      await this.redis.deleteCacheValue(key);
      return;
    }
    this.codeStore.delete(key);
  }

  private async checkRateLimit(key: string): Promise<boolean> {
    if (this.redis.isEnabled()) {
      const count = await this.redis.incrementRateLimit(
        key,
        SMS_RATE_WINDOW_SEC,
      );
      return count != null && count <= SMS_RATE_MAX;
    }
    const now = Date.now();
    const entry = this.rateStore.get(key);
    if (!entry || entry.resetAt <= now) {
      this.rateStore.set(key, {
        count: 1,
        resetAt: now + SMS_RATE_WINDOW_SEC * 1000,
      });
      return true;
    }
    entry.count += 1;
    return entry.count <= SMS_RATE_MAX;
  }
}
