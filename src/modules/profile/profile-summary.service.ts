import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ownerFilterFromActor } from '../../common/auth/actor-query.util';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  IActivityRegistrationRepository,
} from '../activity/registration/interfaces/activity-registration.repository.interface';
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

export interface ProfileSummaryDto {
  name: string;
  handle: string;
  location: string;
  bio: string;
  avatar: string;
  stats: {
    events: number;
    posts: number;
  };
}

export interface ProfileActivityItemDto {
  id: string;
  title: string;
  date: string;
  location: string;
  image: string;
  status: 'registered' | 'attended';
  activityLegacyId: string;
}

@Injectable()
export class ProfileSummaryService {
  constructor(
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: IActivityRegistrationRepository,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    @Inject(POST_READ_PORT)
    private readonly postRead: IPostReadPort,
    private readonly userService: UserService,
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

    const [profile, registrations, ownerPosts] = await Promise.all([
      this.userService.resolveProfile(actor),
      this.registrationRepository.findByOwner(filter),
      this.postRead.listByOwner(actor),
    ]);

    const visibleRegistrations = registrations.filter(
      (registration) => registration.activityLegacyId !== 3,
    );
    const events =
      visibleRegistrations.length +
      (shouldInjectDevProfileStorm(
        visibleRegistrations.map(
          (registration) => registration.activityLegacyId,
        ),
      )
        ? 1
        : 0);

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
        events,
        posts,
      },
    };
  }

  async listActivities(actor: RequestActor): Promise<ProfileActivityItemDto[]> {
    const filter = ownerFilterFromActor(actor);
    const registrations = (
      await this.registrationRepository.findByOwner(filter)
    ).filter((registration) => registration.activityLegacyId !== 3);

    const activityMap = await this.activityLookup.findByLegacyIds(
      registrations.map((registration) => registration.activityLegacyId),
    );

    const items = registrations.map((registration) => {
      const activity = activityMap.get(registration.activityLegacyId);
      const title = activity?.name ?? `活动 ${registration.activityLegacyId}`;
      const date = activity?.date ?? '';
      return {
        id: String(registration.activityLegacyId),
        title,
        date,
        location: activity?.location ?? '',
        image: activity?.image ?? '',
        status: resolveProfileActivityStatus(date, title),
        activityLegacyId: String(registration.activityLegacyId),
      };
    });

    const sorted = items.sort(compareActivityDateDesc);
    const stormActivity = await this.activityLookup.findByLegacyId(
      DEV_PROFILE_STORM_LEGACY_ID,
    );

    return appendDevProfileStormActivity(
      sorted,
      stormActivity,
      registrations.map((registration) => registration.activityLegacyId),
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
