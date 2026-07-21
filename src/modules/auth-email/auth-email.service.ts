import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthLoginResult } from '@sync/profile-contracts';
import { toRequestActor } from '../../common/auth/actor-query.util';
import { buildAuthCapabilities } from '../../common/auth/auth-capabilities';
import {
  emailExternalId,
  isValidEmail,
  normalizeEmail,
} from '../../common/auth/email.util';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { generatePersonalityRaverAvatarKey } from '../personality-test/utils/personality-raver-avatar.util';
import { UserService } from '../user/user.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../user/interfaces/user.repository.interface';
import type { Request } from 'express';

const SUCCESS_MESSAGE = "You're signed in.";

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly rateLimit: PublicApiRateLimitService,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  isEnabled(): boolean {
    const raw = this.config
      .get<string>('auth.tempEmailOnlyAuthEnabled')
      ?.toString()
      .trim()
      .toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    return process.env.NODE_ENV !== 'production';
  }

  async loginWithEmail(
    emailRaw: string,
    req: Request,
    options?: { returnUrl?: string; intendedAction?: string },
  ): Promise<{
    message: string;
    accessToken: string;
    user: AuthLoginResult['user'];
    capabilities: ReturnType<typeof buildAuthCapabilities>;
    returnUrl: string | null;
    intendedAction: string | null;
  }> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Email sign-in is temporarily unavailable. Please try again later.',
      );
    }

    if (!isValidEmail(emailRaw)) {
      throw new BadRequestException('Enter a valid email address.');
    }

    const { email, emailNormalized } = normalizeEmail(emailRaw);

    await this.rateLimit.assertAllowedAsync('auth_email_login_ip', req);
    await this.rateLimit.assertAllowedAsync(
      'auth_email_login_email',
      req,
      emailNormalized,
    );

    const existing = await this.users.findByEmailNormalized(emailNormalized);
    const externalId =
      existing?.externalId?.trim() || emailExternalId(emailNormalized);

    if (!existing) {
      // Ensure we never collide with a different account that somehow shares the hash id.
      const byId = await this.users.findByExternalId(externalId);
      if (byId?.emailNormalized && byId.emailNormalized !== emailNormalized) {
        this.logger.error('email_external_id_collision', {
          externalId,
        });
        throw new HttpException('Sign-in failed. Please try again.', 500);
      }
    }

    const localPart = emailNormalized.split('@')[0] || 'traveler';
    const defaultName = existing?.name?.trim() || localPart.slice(0, 24);
    const defaultHandle =
      existing?.handle?.trim() ||
      `@${localPart.replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'raven'}`;

    const record = await this.users.upsertByExternalId(externalId, {
      email,
      emailNormalized,
      // Temporary flow: never mark verified here.
      emailVerifiedAt: existing?.emailVerifiedAt ?? null,
      lastLoginAt: new Date(),
      name: defaultName,
      handle: defaultHandle,
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

    // Session rotation equivalent for JWT: bump tokenVersion so older tokens die.
    const tokenVersion = await this.users.incrementTokenVersion(uid);
    const user = await this.userService.getMe(
      toRequestActor(uid, record.name ?? defaultName),
    );
    const accessToken = this.jwtService.sign({
      sub: user.id,
      name: user.name,
      tv: tokenVersion,
    });

    return {
      message: SUCCESS_MESSAGE,
      accessToken,
      user,
      capabilities: buildAuthCapabilities(record.emailVerifiedAt ?? null),
      returnUrl: sanitizeReturnUrl(options?.returnUrl),
      intendedAction: sanitizeIntendedAction(options?.intendedAction),
    };
  }

  async issueWebSession(input: {
    id?: string;
    email?: string;
    name?: string;
    image?: string;
    provider?: 'google' | 'email';
    providerUserId?: string;
  }) {
    const id = input.id?.trim();
    const email = input.email?.trim();
    if (!id || !email || !isValidEmail(email)) {
      throw new UnauthorizedException('Invalid authenticated session.');
    }
    const normalized = normalizeEmail(email);
    const byId = await this.users.findByExternalId(id);
    const byEmail = byId
      ? null
      : await this.users.findByEmailNormalized(normalized.emailNormalized);
    // Prefer an existing Nest identity (by Auth.js id or verified email) so
    // Google sign-in does not collide on unique emailNormalized / providerSubject.
    const externalId =
      byId?.externalId?.trim() || byEmail?.externalId?.trim() || id;
    const existing = byId ?? byEmail;
    const provider = input.provider ?? 'google';
    const providerUserId = input.providerUserId?.trim() || id;
    const baseUpdate = {
      email: normalized.email,
      emailNormalized: normalized.emailNormalized,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      name:
        existing?.name?.trim() ||
        input.name?.trim() ||
        normalized.email.split('@')[0] ||
        'Raver',
      handle: existing?.handle?.trim() || '@raven',
      location: existing?.location,
      bio: existing?.bio,
      avatar: existing?.avatar || input.image?.trim() || '',
    };
    let record;
    try {
      record = await this.users.upsertByExternalId(externalId, {
        ...baseUpdate,
        provider,
        providerUserId,
      });
    } catch (error) {
      // Unique (provider, providerUserId) can collide when an older Nest row
      // already owns this Google subject. Still mint a session for the
      // email/externalId we resolved — Squad must not hard-fail on mint.
      this.logger.warn('web_session_provider_upsert_failed', {
        externalId,
        provider,
        message: error instanceof Error ? error.message : String(error),
      });
      record = await this.users.upsertByExternalId(externalId, baseUpdate);
    }
    // Exchanging a verified Auth.js session for a Nest bearer token is not a
    // new login. Rotating here invalidates the cookie we have just minted and
    // races AuthService's token-version cache on the next `/me` request.
    // Token versions are still rotated by explicit logout/revocation.
    const tokenVersion = await this.users.getTokenVersion(externalId);
    const accessToken = this.jwtService.sign({
      sub: externalId,
      name: record.name,
      tv: tokenVersion,
    });
    return { accessToken };
  }
}

function sanitizeReturnUrl(raw?: string): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ||
    value.startsWith('//') ||
    value.includes('\\') ||
    !value.startsWith('/')
  ) {
    return null;
  }
  if (value.includes('/../') || value.endsWith('/..')) return null;
  try {
    const url = new URL(value, 'https://raven.local');
    if (url.origin !== 'https://raven.local') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

const INTENDED = new Set([
  'create_squad_profile',
  'edit_squad_profile',
  'send_connection_request',
  'view_sent_requests',
  'view_received_requests',
  'manage_squad_visibility',
  'logout',
]);

function sanitizeIntendedAction(raw?: string): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return INTENDED.has(value) ? value : null;
}
