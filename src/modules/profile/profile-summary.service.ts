import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationDocument,
} from '../../database/schemas/activity-registration.schema';
import { ActivityService } from '../activity/activity.service';
import { PostService } from '../post/post.service';
import { canViewPersonalInfo } from '../../common/utils/privacy.util';
import { UserBlockService } from '../user/user-block.service';
import { UserService } from '../user/user.service';
import { resolveProfileActivityStatus, compareActivityDateDesc } from '../../common/utils/activity-date.util';
import { ACTIVITY_REGISTRATION_SEED } from './activity-registration.seed';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  ActivityRegistrationQueryFilter,
  IActivityRegistrationRepository,
} from './interfaces/activity-registration.repository.interface';

function resolveOwnerFilter(
  userId?: string,
  authorName?: string,
): ActivityRegistrationQueryFilter {
  const uid = userId?.trim();
  const name = authorName?.trim() || 'Zara';
  return {
    userId: uid || undefined,
    authorName: name,
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
export class ProfileSummaryService implements OnModuleInit {
  constructor(
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: IActivityRegistrationRepository,
    @InjectModel(ActivityRegistration.name)
    private readonly registrationModel: Model<ActivityRegistrationDocument>,
    private readonly activityService: ActivityService,
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly userBlockService: UserBlockService,
  ) {}

  async onModuleInit() {
    await this.registrationModel.deleteMany({ activityLegacyId: { $in: [3, 7] } });
    for (const item of ACTIVITY_REGISTRATION_SEED) {
      await this.registrationModel.findOneAndUpdate(
        { userId: item.userId, activityLegacyId: item.activityLegacyId },
        item,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  async getSummary(
    userId?: string,
    authorName?: string,
    viewerUserId?: string,
    viewerAuthorName?: string,
  ): Promise<ProfileSummaryDto> {
    const filter = resolveOwnerFilter(userId, authorName);
    const ownerExternalId = filter.userId ?? userId?.trim();
    const viewerId = viewerUserId?.trim() || ownerExternalId;
    const isOwner =
      !viewerId ||
      !ownerExternalId ||
      viewerId === ownerExternalId;

    const [profile, events, likes, posts, completedPosts, buddyUserIds] =
      await Promise.all([
        this.userService.resolveProfile(userId, authorName),
        this.registrationRepository.countByOwner(filter),
        this.postService.sumLikesByOwner(userId, authorName),
        this.postService.countByOwner(userId, authorName),
        this.postService.countCompletedByOwner(userId, authorName),
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

    return {
      name: profile?.name ?? 'Zara Chen',
      handle: profile?.handle ?? '@zara',
      location: canView ? profile?.location ?? '上海' : '',
      bio: canView ? profile?.bio ?? '电音爱好者' : '',
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

  async listActivities(
    userId?: string,
    authorName?: string,
  ): Promise<ProfileActivityItemDto[]> {
    const filter = resolveOwnerFilter(userId, authorName);
    const registrations = (
      await this.registrationRepository.findByOwner(filter)
    ).filter(registration => registration.activityLegacyId !== 3);

    const items = await Promise.all(
      registrations.map(async registration => {
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

  listPosts(userId?: string, authorName?: string) {
    return this.postService.listByOwner(userId, authorName);
  }
}
