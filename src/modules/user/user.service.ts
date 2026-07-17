import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import {
  UserProfile,
  UserProfileDocument,
} from '../../database/schemas/user-profile.schema';
import { UpdateRavenProfileDto } from './dto/update-raven-profile.dto';
import { normalizePrivacyLevel } from '../../common/utils/privacy.util';
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
import type { CurrentUser } from '@sync/profile-contracts';
import type { RequestActor } from '../../common/auth/request-actor.types';

export type UserMeDto = CurrentUser;

const EMPTY_PROFILE_DEFAULTS = {
  name: '用户',
  handle: '@user',
  location: '',
  bio: '',
  avatar: '',
  notificationsEnabled: true,
  privacyLevel: 'public' as const,
};

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: IUserRepository,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name)
    private readonly profileModel: Model<UserProfileDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly accountRisk: AccountRiskService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const result = await this.userModel.updateMany(
        { privacyLevel: 'friends' },
        { $set: { privacyLevel: 'private' } },
      );
      if (result.modifiedCount > 0) {
        this.logger.log(
          `Migrated ${result.modifiedCount} user privacyLevel friends → private`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `privacyLevel migration failed: ${(error as Error).message}`,
      );
    }
  }

  ping() {
    return { ok: true, scope: 'user' };
  }

  async resolveProfile(actor: RequestActor): Promise<UserRecord | null> {
    const uid = actor.clientUserId?.trim();
    if (!uid) return null;
    return this.repository.findByExternalId(uid);
  }

  private resolveExternalId(actor: RequestActor): string {
    return actor.resolvedUserId;
  }

  private toMeDto(record: UserRecord, externalId: string): UserMeDto {
    const city = record.city?.trim();
    const favorGenres = (record.favorGenres ?? [])
      .map((genre) => genre.trim())
      .filter(Boolean);
    const budgetLevel = record.budgetLevel?.trim();

    return {
      id: record.externalId ?? externalId,
      name: record.name ?? EMPTY_PROFILE_DEFAULTS.name,
      handle: record.handle ?? EMPTY_PROFILE_DEFAULTS.handle,
      location: record.location ?? EMPTY_PROFILE_DEFAULTS.location,
      bio: record.bio ?? EMPTY_PROFILE_DEFAULTS.bio,
      avatar: record.avatar ?? EMPTY_PROFILE_DEFAULTS.avatar,
      ...(city ? { city } : {}),
      ...(favorGenres.length ? { favorGenres } : {}),
      ...(budgetLevel ? { budgetLevel } : {}),
      notificationsEnabled:
        record.notificationsEnabled ??
        EMPTY_PROFILE_DEFAULTS.notificationsEnabled,
      privacyLevel: normalizePrivacyLevel(
        record.privacyLevel ?? EMPTY_PROFILE_DEFAULTS.privacyLevel,
      ),
    };
  }

  async findPrivacyLevelsByExternalIds(
    externalIds: string[],
  ): Promise<Map<string, 'public' | 'private'>> {
    const unique = [...new Set(externalIds.filter(Boolean))];
    if (!unique.length) return new Map();

    const rows = await this.repository.findByExternalIds(unique);
    const map = new Map<string, 'public' | 'private'>();
    for (const row of rows) {
      if (!row.externalId) continue;
      map.set(
        row.externalId,
        normalizePrivacyLevel(
          row.privacyLevel ?? EMPTY_PROFILE_DEFAULTS.privacyLevel,
        ),
      );
    }
    return map;
  }

  async findAuthorSummariesByExternalIds(
    externalIds: string[],
  ): Promise<Map<string, { name: string; avatar: string }>> {
    const unique = [
      ...new Set(externalIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!unique.length) return new Map();

    const rows = await this.repository.findSummariesByExternalIds(unique);
    const map = new Map<string, { name: string; avatar: string }>();
    for (const row of rows) {
      const externalId = row.externalId?.trim();
      if (!externalId) continue;
      map.set(externalId, {
        name: row.name?.trim() || EMPTY_PROFILE_DEFAULTS.name,
        avatar: row.avatar?.trim() || '',
      });
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

  async getRavenProfile(actor: RequestActor) {
    const userId = this.resolveExternalId(actor);
    return this.profileModel.findOne({ userId }).lean();
  }

  /**
   * A deliberately small, authenticated summary for the Raven profile entry
   * point. Detailed Squad data remains scoped to its festival endpoint so a
   * profile cannot accidentally reveal another attendee's information.
   */
  async getRavenOverview(actor: RequestActor) {
    const userId = this.resolveExternalId(actor);
    const db = this.connection.db;
    if (!db) throw new Error('Database connection unavailable');

    const [profile, journeys, squadProfiles, artistLikes] = await Promise.all([
      this.profileModel
        .findOne(
          { userId },
          { favoriteFestivalIds: 1, favoriteGenres: 1, favoriteArtistIds: 1 },
        )
        .lean(),
      db
        .collection('travel_guide_saved_plans')
        .find(
          { ownerUserId: userId },
          { projection: { guideId: 1, activityLegacyId: 1, updatedAt: 1 } },
        )
        .sort({ updatedAt: -1 })
        .limit(12)
        .toArray(),
      db
        .collection('festival_squad_profiles')
        .find(
          { userId },
          {
            projection: {
              eventId: 1,
              displayName: 1,
              matchingPaused: 1,
              visibility: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ updatedAt: -1 })
        .toArray(),
      db
        .collection('user_artist_likes')
        .find({ userId }, { projection: { artistId: 1 } })
        .toArray(),
    ]);

    const favoriteArtistIds = [
      ...new Set(
        [
          ...(profile?.favoriteArtistIds ?? []),
          ...artistLikes.map((like) => String(like.artistId ?? '').trim()),
        ].filter(Boolean),
      ),
    ];
    const favoriteArtists = favoriteArtistIds.length
      ? await db
          .collection('artist_performances')
          .aggregate<{ _id: string; name: string }>([
            { $match: { artistId: { $in: favoriteArtistIds } } },
            { $group: { _id: '$artistId', name: { $first: '$artistName' } } },
          ])
          .toArray()
      : [];
    const artistNameById = new Map(
      favoriteArtists.map((artist) => [artist._id, artist.name]),
    );

    const squadProfileIds = squadProfiles.map((profile) => String(profile._id));
    const pendingSquadRequestsByEvent: Record<
      string,
      { received: number; sent: number }
    > = {};
    if (squadProfileIds.length) {
      const profileEventById = new Map(
        squadProfiles.map((profile) => [
          String(profile._id),
          Number(profile.eventId),
        ]),
      );
      const pendingRequests = await db
        .collection('festival_squad_connection_requests')
        .find(
          {
            status: 'pending',
            $or: [
              { senderProfileId: { $in: squadProfileIds } },
              { receiverProfileId: { $in: squadProfileIds } },
            ],
          },
          { projection: { senderProfileId: 1, receiverProfileId: 1 } },
        )
        .toArray();
      for (const request of pendingRequests) {
        const senderEventId = profileEventById.get(
          String(request.senderProfileId),
        );
        const receiverEventId = profileEventById.get(
          String(request.receiverProfileId),
        );
        const eventId = receiverEventId ?? senderEventId;
        if (eventId === undefined) continue;
        const summary = (pendingSquadRequestsByEvent[String(eventId)] ??= {
          received: 0,
          sent: 0,
        });
        if (receiverEventId !== undefined) summary.received += 1;
        if (senderEventId !== undefined) summary.sent += 1;
      }
    }

    return {
      profile: {
        favoriteFestivalIds: profile?.favoriteFestivalIds ?? [],
        favoriteGenres: profile?.favoriteGenres ?? [],
        favoriteArtistIds,
        favoriteArtists: favoriteArtistIds.map((id) => ({
          id,
          name: artistNameById.get(id) ?? id,
        })),
      },
      journeys: journeys.map((journey) => ({
        guideId: String(journey.guideId),
        activityLegacyId: Number(journey.activityLegacyId),
        updatedAt: journey.updatedAt,
      })),
      squadProfiles: squadProfiles.map((squadProfile) => ({
        eventId: Number(squadProfile.eventId),
        displayName: String(squadProfile.displayName ?? ''),
        matchingPaused: Boolean(squadProfile.matchingPaused),
        visibility: squadProfile.visibility ?? {},
        updatedAt: squadProfile.updatedAt,
      })),
      pendingSquadRequestsByEvent,
    };
  }

  async patchRavenProfile(body: UpdateRavenProfileDto, actor: RequestActor) {
    const userId = this.resolveExternalId(actor);
    return this.profileModel
      .findOneAndUpdate(
        { userId },
        { $set: body, $setOnInsert: { userId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
  }

  /**
   * Permanently remove data that identifies this Raven account. Public content
   * that has legal retention requirements must be anonymised by its owner module.
   */
  async deleteAccount(actor: RequestActor): Promise<void> {
    const userId = this.resolveExternalId(actor);
    const db = this.connection.db;
    if (!db) throw new Error('Database connection unavailable');

    const profiles = db.collection('festival_squad_profiles');
    const profileIds = (
      await profiles.find({ userId }, { projection: { _id: 1 } }).toArray()
    ).map((row) => row._id);
    await Promise.all([
      db.collection('user_profiles').deleteMany({ userId }),
      db.collection('user_itineraries').deleteMany({ userId }),
      db
        .collection('travel_guide_saved_plans')
        .deleteMany({ ownerUserId: userId }),
      db.collection('user_artist_likes').deleteMany({ userId }),
      db.collection('festival_squad_connection_requests').deleteMany({
        $or: [
          { senderProfileId: { $in: profileIds.map(String) } },
          { receiverProfileId: { $in: profileIds.map(String) } },
        ],
      }),
      profiles.deleteMany({ userId }),
      db.collection('users').deleteOne({ externalId: userId }),
    ]);
  }
}
