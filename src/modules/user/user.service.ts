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
import { ChromaService } from '../../ai/rag/chroma.service';

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

  async resolveProfile(userId?: string, authorName?: string) {
    if (isDemoOwnerClient(userId, authorName)) {
      return this.repository.findDefaultProfile();
    }

    const uid = userId?.trim();
    if (uid && uid !== DEFAULT_PROFILE_EXTERNAL_ID) {
      const found = await this.repository.findByExternalId(uid);
      if (found) return found;
    }

    return this.repository.findDefaultProfile();
  }

  private resolveExternalId(userId?: string, authorName?: string): string {
    const uid = userId?.trim();
    if (isDemoOwnerClient(uid, authorName)) {
      return DEMO_OWNER_USER_ID;
    }
    return uid || DEMO_OWNER_USER_ID;
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
      map.set(
        row.externalId,
        row.privacyLevel ?? DEMO_PROFILE.privacyLevel,
      );
    }
    return map;
  }

  async isNotificationsEnabled(
    userId?: string,
    authorName?: string,
  ): Promise<boolean> {
    try {
      const me = await this.getMe(userId, authorName);
      return me.notificationsEnabled !== false;
    } catch {
      return true;
    }
  }

  async getMe(userId?: string, authorName?: string): Promise<UserMeDto> {
    const profile = await this.resolveProfile(userId, authorName);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    const externalId = this.resolveExternalId(userId, authorName);
    return this.toMeDto(profile, externalId);
  }

  async patchMe(
    body: UpdateUserMeDto,
    userId?: string,
    authorName?: string,
  ): Promise<UserMeDto> {
    const externalId = this.resolveExternalId(userId, authorName);
    const updated = await this.repository.updateByExternalId(externalId, body);
    if (!updated) {
      throw new NotFoundException('User profile not found');
    }

    void this.syncUserProfileVector(updated, externalId);

    return this.toMeDto(updated, externalId);
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
