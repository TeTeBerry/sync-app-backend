import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ownerFilterFromActor } from '../../common/auth/actor-query.util';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  ActivityRegistrationQueryFilter,
  IActivityRegistrationRepository,
} from '../activity/registration/interfaces/activity-registration.repository.interface';
import {
  POST_READ_PORT,
  type IPostReadPort,
} from '../partner/ports/post-read.port';
import { canViewPersonalInfo } from '../../common/utils/privacy.util';
import { UserService } from '../user/user.service';
import {
  resolveProfileActivityStatus,
  compareActivityDateDesc,
} from '../../common/utils/activity-date.util';

function registrationFilterFromActor(
  actor: RequestActor,
): ActivityRegistrationQueryFilter {
  const filter = ownerFilterFromActor(actor);
  return {
    userId: filter.userId,
    authorName: filter.authorName?.trim() || 'Zara',
  };
}

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
    const filter = registrationFilterFromActor(actor);
    const ownerExternalId = filter.userId ?? actor.clientUserId?.trim();
    const viewerId = viewer?.resolvedUserId ?? ownerExternalId;
    const isOwner =
      !viewerId || !ownerExternalId || viewerId === ownerExternalId;

    const [profile, events, ownerPosts] = await Promise.all([
      this.userService.resolveProfile(actor),
      this.registrationRepository.countByOwner(filter),
      this.postRead.listByOwner(actor),
    ]);

    const privacyLevel =
      (profile as { privacyLevel?: 'public' | 'friends' | 'private' })
        ?.privacyLevel ?? 'public';
    const canView = canViewPersonalInfo(privacyLevel, isOwner, false);

    const posts = ownerPosts.length;

    return {
      name: profile?.name ?? 'Zara Chen',
      handle: profile?.handle ?? '@zara',
      location: canView ? (profile?.location ?? '上海') : '',
      bio: canView ? (profile?.bio ?? '电音爱好者') : '',
      avatar:
        profile?.avatar ??
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
      stats: {
        events,
        posts,
      },
    };
  }

  async listActivities(actor: RequestActor): Promise<ProfileActivityItemDto[]> {
    const filter = registrationFilterFromActor(actor);
    const registrations = (
      await this.registrationRepository.findByOwner(filter)
    ).filter((registration) => registration.activityLegacyId !== 3);

    const items = await Promise.all(
      registrations.map(async (registration) => {
        const activity = await this.activityLookup.findByLegacyId(
          registration.activityLegacyId,
        );
        const title = activity?.name ?? `活动 ${registration.activityLegacyId}`;
        const date = activity?.date ?? '';
        return {
          id: String(registration.activityLegacyId),
          title,
          date,
          location: activity?.location ?? '',
          image: activity?.image ?? '',
          status: resolveProfileActivityStatus(date, title),
        };
      }),
    );

    return items.sort(compareActivityDateDesc);
  }

  listPosts(actor: RequestActor) {
    return this.postRead.listByOwner(actor);
  }
}
