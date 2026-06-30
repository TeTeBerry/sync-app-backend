import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ownerFilterFromActor } from '../../common/auth/actor-query.util';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import {
  POST_READ_PORT,
  type IPostReadPort,
} from '../partner/ports/post-read.port';
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
import type {
  ProfileActivityItem,
  ProfileSummary,
} from '@sync/profile-contracts';

export type ProfileSummaryDto = ProfileSummary;

export type ProfileActivityItemDto = ProfileActivityItem;

@Injectable()
export class ProfileSummaryService {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    @Inject(POST_READ_PORT)
    private readonly postRead: IPostReadPort,
    private readonly userService: UserService,
    private readonly activityEligibility: ProfileActivityEligibilityService,
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

    const [profile, eligibleLegacyIds, ownerPosts] = await Promise.all([
      this.userService.resolveProfile(actor),
      this.activityEligibility.listEligibleActivityLegacyIds(actor),
      this.postRead.listByOwner(actor),
    ]);

    const activityStats = await this.countActivityStats(eligibleLegacyIds);

    const privacyLevel =
      (profile as { privacyLevel?: 'public' | 'friends' | 'private' })
        ?.privacyLevel ?? 'public';
    const canView = canViewPersonalInfo(privacyLevel, isOwner, false);

    const posts = ownerPosts.length;

    return {
      name: profile?.name ?? '用户',
      handle: profile?.handle ?? '@user',
      location: canView ? (profile?.location ?? '') : '',
      bio: canView ? (profile?.bio ?? '') : '',
      avatar: profile?.avatar?.trim() ?? '',
      stats: {
        events: activityStats.total,
        ongoingEvents: activityStats.ongoing,
        posts,
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

  listPosts(actor: RequestActor) {
    return this.postRead.listByOwner(actor);
  }

  async listPostsPage(
    actor: RequestActor,
    options?: { limit?: number; cursor?: string },
  ) {
    return this.postRead.listByOwnerPage(actor, options);
  }
}
