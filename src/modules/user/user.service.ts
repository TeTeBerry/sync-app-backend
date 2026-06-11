import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  IUserRepository,
  UserRecord,
  USER_REPOSITORY,
} from './interfaces/user.repository.interface';
import { DEFAULT_PROFILE_EXTERNAL_ID } from './user.repository';
import {
  DEMO_OWNER_USER_ID,
  isDemoOwnerClient,
} from '../../common/utils/demo-owner.util';
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
import { ChromaService } from '../../infra/chroma/chroma.service';
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
  likeMate?: boolean;
  notificationsEnabled?: boolean;
  privacyLevel?: 'public' | 'friends' | 'private';
  accountRisk?: AccountRiskPublicStatus;
}

const DEMO_PROFILE = {
  externalId: DEFAULT_PROFILE_EXTERNAL_ID,
  name: 'Zara Chen',
  handle: '@zara',
  location: '上海',
  bio: '电音爱好者',
  avatar:
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  city: '上海',
  favorGenres: ['EDM', 'Techno'],
  budgetLevel: 'medium',
  likeMate: true,
  notificationsEnabled: true,
  privacyLevel: 'public' as const,
};

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: IUserRepository,
    private readonly chromaService: ChromaService,
    private readonly accountRisk: AccountRiskService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  async onModuleInit() {
    await this.repository.upsertDefaultProfile(DEMO_PROFILE);
  }

  ping() {
    return { ok: true, scope: 'user' };
  }

  getDefaultProfile() {
    return this.repository.findDefaultProfile();
  }

  async resolveProfile(actor: RequestActor) {
    if (isDemoOwnerClient(actor.clientUserId, actor.displayName)) {
      return this.repository.findDefaultProfile();
    }

    const uid = actor.clientUserId?.trim();
    if (uid && uid !== DEFAULT_PROFILE_EXTERNAL_ID) {
      const found = await this.repository.findByExternalId(uid);
      if (found) return found;
    }

    return this.repository.findDefaultProfile();
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
      name: record.name ?? DEMO_PROFILE.name,
      handle: record.handle ?? DEMO_PROFILE.handle,
      location: record.location ?? DEMO_PROFILE.location,
      bio: record.bio ?? DEMO_PROFILE.bio,
      avatar: record.avatar ?? DEMO_PROFILE.avatar,
      city: record.city ?? DEMO_PROFILE.city,
      favorGenres: record.favorGenres ?? DEMO_PROFILE.favorGenres,
      budgetLevel: record.budgetLevel ?? DEMO_PROFILE.budgetLevel,
      likeMate: record.likeMate ?? DEMO_PROFILE.likeMate,
      notificationsEnabled:
        record.notificationsEnabled ?? DEMO_PROFILE.notificationsEnabled,
      privacyLevel: record.privacyLevel ?? DEMO_PROFILE.privacyLevel,
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
      map.set(row.externalId, row.privacyLevel ?? DEMO_PROFILE.privacyLevel);
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
        name: actor.displayName?.trim() || DEMO_PROFILE.name,
        handle: DEMO_PROFILE.handle,
        location: DEMO_PROFILE.location,
        bio: DEMO_PROFILE.bio,
        avatar: DEMO_PROFILE.avatar,
        notificationsEnabled: DEMO_PROFILE.notificationsEnabled,
        privacyLevel: DEMO_PROFILE.privacyLevel,
        ...body,
      }));

    if (!record) {
      throw new NotFoundException('User profile not found');
    }

    void this.syncUserProfileVector(record, externalId);

    return this.toMeDto(record, externalId);
  }

  /** Merge city from light apply when profile has no city yet. */
  async mergeProfileCityIfEmpty(
    externalId: string,
    city: string,
  ): Promise<void> {
    const trimmed = city?.trim();
    if (!trimmed || !externalId?.trim()) return;

    const existing = await this.repository.findByExternalId(externalId.trim());
    if (existing?.city?.trim()) return;

    const record = existing
      ? await this.repository.updateByExternalId(externalId.trim(), {
          city: trimmed,
        })
      : await this.repository.upsertByExternalId(externalId.trim(), {
          city: trimmed,
          name: DEMO_PROFILE.name,
          handle: DEMO_PROFILE.handle,
          location: DEMO_PROFILE.location,
          bio: DEMO_PROFILE.bio,
          avatar: DEMO_PROFILE.avatar,
          notificationsEnabled: DEMO_PROFILE.notificationsEnabled,
          privacyLevel: DEMO_PROFILE.privacyLevel,
        });

    if (record) {
      void this.syncUserProfileVector(record, externalId.trim());
    }
  }

  /** Sync user profile vector to Chroma (also callable after UserProfileAgent extraction) */
  syncUserProfileVector(record: UserRecord, externalId?: string): void {
    const userId = record.externalId ?? externalId;
    if (!userId?.trim()) return;

    void this.chromaService.upsertUserProfileEmbedding({
      userId: userId.trim(),
      city: record.city,
      favorGenres: record.favorGenres,
      likeMate: record.likeMate,
      bio: record.bio,
      budgetLevel: record.budgetLevel,
      location: record.location,
    });
  }
}
