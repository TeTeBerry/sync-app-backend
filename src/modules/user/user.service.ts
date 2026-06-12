import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  UserRecord,
  USER_REPOSITORY,
} from './interfaces/user.repository.interface';
import { UpdateUserMeDto } from './dto/update-user-me.dto';
import {
  assertUserUgcTexts,
  collectProfilePatchUgcTexts,
} from '../../common/media/user-ugc-text.util';
import { assertUserUgcImageRef } from '../../common/media/user-ugc-image.util';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { MediaSecurityCheckService } from '../media-security/media-security-check.service';
import { AccountRiskService } from '../account-risk/account-risk.service';
import type { AccountRiskPublicStatus } from '../account-risk/account-risk.service';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { toRequestActor } from '../../common/auth/actor-query.util';
import type { StoredAuthorRecord } from './stored-author.types';

export type { StoredAuthorRecord } from './stored-author.types';

export interface UserMeDto {
  id: string;
  name: string;
  handle: string;
  location: string;
  bio: string;
  avatar: string;
  city?: string;
  favorGenres?: string[];
  budgetLevel?: string;
  notificationsEnabled?: boolean;
  privacyLevel?: 'public' | 'friends' | 'private';
  accountRisk?: AccountRiskPublicStatus;
}

const EMPTY_PROFILE_DEFAULTS = {
  name: '用户',
  handle: '@user',
  location: '',
  bio: '',
  avatar: '',
  city: '',
  favorGenres: [] as string[],
  budgetLevel: '',
  notificationsEnabled: true,
  privacyLevel: 'public' as const,
};

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: IUserRepository,
    private readonly accountRisk: AccountRiskService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  ping() {
    return { ok: true, scope: 'user' };
  }

  async resolveProfile(actor: RequestActor): Promise<UserRecord | null> {
    const uid = actor.clientUserId?.trim();
    if (!uid) return null;
    return this.repository.findByExternalId(uid);
  }

  /** Resolve profile for stored post/comment author fields. */
  resolveProfileFromStoredAuthor(record: StoredAuthorRecord) {
    return this.resolveProfile(
      toRequestActor(record.userId, record.authorName),
    );
  }

  private resolveExternalId(actor: RequestActor): string {
    return actor.resolvedUserId;
  }

  private toMeDto(record: UserRecord, externalId: string): UserMeDto {
    return {
      id: record.externalId ?? externalId,
      name: record.name ?? EMPTY_PROFILE_DEFAULTS.name,
      handle: record.handle ?? EMPTY_PROFILE_DEFAULTS.handle,
      location: record.location ?? EMPTY_PROFILE_DEFAULTS.location,
      bio: record.bio ?? EMPTY_PROFILE_DEFAULTS.bio,
      avatar: record.avatar ?? EMPTY_PROFILE_DEFAULTS.avatar,
      city: record.city ?? EMPTY_PROFILE_DEFAULTS.city,
      favorGenres: record.favorGenres ?? EMPTY_PROFILE_DEFAULTS.favorGenres,
      budgetLevel: record.budgetLevel ?? EMPTY_PROFILE_DEFAULTS.budgetLevel,
      notificationsEnabled:
        record.notificationsEnabled ??
        EMPTY_PROFILE_DEFAULTS.notificationsEnabled,
      privacyLevel: record.privacyLevel ?? EMPTY_PROFILE_DEFAULTS.privacyLevel,
    };
  }

  async findPrivacyLevelsByExternalIds(
    externalIds: string[],
  ): Promise<Map<string, 'public' | 'friends' | 'private'>> {
    const unique = [...new Set(externalIds.filter(Boolean))];
    if (!unique.length) return new Map();

    const rows = await this.repository.findByExternalIds(unique);
    const map = new Map<string, 'public' | 'friends' | 'private'>();
    for (const row of rows) {
      if (!row.externalId) continue;
      map.set(
        row.externalId,
        row.privacyLevel ?? EMPTY_PROFILE_DEFAULTS.privacyLevel,
      );
    }
    return map;
  }

  async isNotificationsEnabled(actor: RequestActor): Promise<boolean> {
    try {
      const me = await this.getMe(actor);
      return me.notificationsEnabled !== false;
    } catch {
      return true;
    }
  }

  async getMe(actor: RequestActor): Promise<UserMeDto> {
    const profile = await this.resolveProfile(actor);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    const externalId = this.resolveExternalId(actor);
    const accountRisk = await this.accountRisk.getPublicStatus(actor);
    return {
      ...this.toMeDto(profile, externalId),
      ...(accountRisk.status !== 'normal' ? { accountRisk } : {}),
    };
  }

  async patchMe(
    body: UpdateUserMeDto,
    actor: RequestActor,
  ): Promise<UserMeDto> {
    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectProfilePatchUgcTexts(body),
    );
    const externalId = this.resolveExternalId(actor);
    await assertUserUgcImageRef(
      this.wechatContentSecurity,
      this.mediaChecks,
      body.avatar,
      externalId,
    );
    const existing = await this.repository.findByExternalId(externalId);
    const updated = existing
      ? await this.repository.updateByExternalId(externalId, body)
      : null;
    const record =
      updated ??
      (await this.repository.upsertByExternalId(externalId, {
        name: actor.displayName?.trim() || EMPTY_PROFILE_DEFAULTS.name,
        handle: EMPTY_PROFILE_DEFAULTS.handle,
        location: EMPTY_PROFILE_DEFAULTS.location,
        bio: EMPTY_PROFILE_DEFAULTS.bio,
        avatar: EMPTY_PROFILE_DEFAULTS.avatar,
        notificationsEnabled: EMPTY_PROFILE_DEFAULTS.notificationsEnabled,
        privacyLevel: EMPTY_PROFILE_DEFAULTS.privacyLevel,
        ...body,
      }));

    if (!record) {
      throw new NotFoundException('User profile not found');
    }

    return this.toMeDto(record, externalId);
  }
}
