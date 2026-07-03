import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ownerFilterFromActor } from '../../common/auth/actor-query.util';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { canViewPersonalInfo } from '../../common/utils/privacy.util';
import { UserService } from '../user/user.service';
import {
  compareActivityDateDesc,
  resolveProfileActivityStatus,
} from '../../common/utils/activity-date.util';
import {
  appendDevProfileStormActivity,
  DEV_PROFILE_STORM_LEGACY_ID,
  shouldInjectDevProfileStorm,
} from './utils/dev-profile-storm-activity.util';
import { ProfileActivityEligibilityService } from './profile-activity-eligibility.service';
import {
  ArtistPerformance,
  type ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import {
  UserArtistLike,
  type UserArtistLikeDocument,
} from '../../database/schemas/user-artist-like.schema';
import type {
  ProfileActivityItem,
  ProfileFootprintItem,
  ProfileSummary,
} from '@sync/profile-contracts';

export type ProfileSummaryDto = ProfileSummary;

export type ProfileActivityItemDto = ProfileActivityItem;

@Injectable()
export class ProfileSummaryService {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly userService: UserService,
    private readonly activityEligibility: ProfileActivityEligibilityService,
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    @InjectModel(UserArtistLike.name)
    private readonly artistLikeModel: Model<UserArtistLikeDocument>,
  ) {}

  async getSummary(
    actor: RequestActor,
    viewer?: RequestActor,
  ): Promise<ProfileSummaryDto> {
    const filter = ownerFilterFromActor(actor);
    const ownerExternalId = filter.userId ?? actor.clientUserId?.trim();
    const viewerId = viewer?.resolvedUserId ?? ownerExternalId;
    const isOwner =
      !viewerId || !ownerExternalId || viewerId === ownerExternalId;

    const [profile, eligibleLegacyIds] = await Promise.all([
      this.userService.resolveProfile(actor),
      this.activityEligibility.listEligibleActivityLegacyIds(actor),
    ]);

    const activityStats = await this.countActivityStats(eligibleLegacyIds);

    const privacyLevel =
      (profile as { privacyLevel?: 'public' | 'friends' | 'private' })
        ?.privacyLevel ?? 'public';
    const canView = canViewPersonalInfo(privacyLevel, isOwner, false);

    return {
      name: profile?.name ?? '用户',
      handle: profile?.handle ?? '@user',
      location: canView ? (profile?.location ?? '') : '',
      bio: canView ? (profile?.bio ?? '') : '',
      avatar: profile?.avatar?.trim() ?? '',
      stats: {
        events: activityStats.total,
        ongoingEvents: activityStats.ongoing,
        posts: 0,
      },
    };
  }

  private async countActivityStats(
    eligibleLegacyIds: number[],
  ): Promise<{ total: number; ongoing: number }> {
    const activityMap =
      await this.activityLookup.findByLegacyIds(eligibleLegacyIds);

    let ongoing = 0;
    for (const activityLegacyId of eligibleLegacyIds) {
      const activity = activityMap.get(activityLegacyId);
      const title = activity?.name ?? `活动 ${activityLegacyId}`;
      const date = activity?.date ?? '';
      if (resolveProfileActivityStatus(date, title) === 'registered') {
        ongoing += 1;
      }
    }

    let total = eligibleLegacyIds.length;
    if (shouldInjectDevProfileStorm(eligibleLegacyIds)) {
      total += 1;
      const stormActivity = await this.activityLookup.findByLegacyId(
        DEV_PROFILE_STORM_LEGACY_ID,
      );
      if (stormActivity) {
        const status = resolveProfileActivityStatus(
          stormActivity.date ?? '',
          stormActivity.name,
        );
        if (status === 'registered') {
          ongoing += 1;
        }
      }
    }

    return { total, ongoing };
  }

  async listActivities(actor: RequestActor): Promise<ProfileActivityItemDto[]> {
    const eligibleLegacyIds =
      await this.activityEligibility.listEligibleActivityLegacyIds(actor);

    const activityMap =
      await this.activityLookup.findByLegacyIds(eligibleLegacyIds);

    const items = eligibleLegacyIds.map((activityLegacyId) => {
      const activity = activityMap.get(activityLegacyId);
      const title = activity?.name ?? `活动 ${activityLegacyId}`;
      const date = activity?.date ?? '';
      return {
        id: String(activityLegacyId),
        title,
        date,
        location: activity?.location ?? '',
        image: activity?.image ?? '',
        status: resolveProfileActivityStatus(date, title),
        activityLegacyId: String(activityLegacyId),
      };
    });

    const sorted = items.sort(compareActivityDateDesc);
    const stormActivity = await this.activityLookup.findByLegacyId(
      DEV_PROFILE_STORM_LEGACY_ID,
    );

    return appendDevProfileStormActivity(
      sorted,
      stormActivity,
      eligibleLegacyIds,
    );
  }

  async listFootprints(actor: RequestActor): Promise<ProfileFootprintItem[]> {
    const activities = await this.listActivities(actor);
    // Only show attended activities as footprints (same as "已参加" in 我的活动)
    const attended = activities.filter((item) => item.status === 'attended');

    if (attended.length === 0) {
      return [];
    }

    const legacyIds = attended.map((item) => Number(item.activityLegacyId));

    // Get user's liked artist IDs
    const userId = actor.resolvedUserId;
    const likes = userId
      ? await this.artistLikeModel.find({ userId }).lean()
      : [];
    const likedArtistIds = likes.map((doc) => doc.artistId);

    // Count liked artists per attended activity
    let artistCountMap = new Map<number, number>();

    if (likedArtistIds.length > 0) {
      const artistCounts = await this.performanceModel.aggregate<{
        _id: number;
        count: number;
      }>([
        {
          $match: {
            activityLegacyId: { $in: legacyIds },
            artistId: { $in: likedArtistIds },
          },
        },
        {
          $group: {
            _id: '$activityLegacyId',
            artists: { $addToSet: '$artistId' },
          },
        },
        { $project: { _id: 1, count: { $size: '$artists' } } },
      ]);
      artistCountMap = new Map(artistCounts.map((r) => [r._id, r.count]));
    }

    return attended.map(({ status: _, ...rest }) => ({
      ...rest,
      artistCount: artistCountMap.get(Number(rest.activityLegacyId)) ?? 0,
    }));
  }
}
