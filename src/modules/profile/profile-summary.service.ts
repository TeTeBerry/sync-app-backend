import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ownerFilterFromActor } from '../../common/auth/actor-query.util';
import { ActivityService } from '../activity/activity.service';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  ActivityRegistrationQueryFilter,
  IActivityRegistrationRepository,
} from '../activity/registration/interfaces/activity-registration.repository.interface';
import { PostService } from '../partner/post.service';
import { canViewPersonalInfo } from '../../common/utils/privacy.util';
import { UserBlockService } from '../user/user-block.service';
import { UserService } from '../user/user.service';
import {
  resolveProfileActivityStatus,
  compareActivityDateDesc,
} from '../../common/utils/activity-date.util';
import { sumProfilePostLikes } from '../../common/utils/profile-likes.util';

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
    matchSuccess: number;
    likes: number;
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
    private readonly activityService: ActivityService,
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly userBlockService: UserBlockService,
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

    const [profile, events, ownerPosts, completedPosts, buddyUserIds] =
      await Promise.all([
        this.userService.resolveProfile(actor),
        this.registrationRepository.countByOwner(filter),
        this.postService.listByOwner(actor),
        this.postService.countCompletedByOwner(actor),
        viewerId
          ? this.userBlockService.loadBuddyUserIds(viewerId)
          : Promise.resolve(new Set<string>()),
      ]);

    const privacyLevel =
      (profile as { privacyLevel?: 'public' | 'friends' | 'private' })
        ?.privacyLevel ?? 'public';
    const canView = canViewPersonalInfo(
      privacyLevel,
      isOwner,
      Boolean(ownerExternalId && buddyUserIds.has(ownerExternalId)),
    );

    const posts = ownerPosts.length;
    const likes = sumProfilePostLikes(ownerPosts);

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
        matchSuccess: completedPosts,
        likes,
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
        const activity = await this.activityService.findByLegacyId(
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
    return this.postService.listByOwner(actor);
  }
}
