import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationDocument,
} from '../../database/schemas/activity-registration.schema';
import { ActivityService } from '../activity/activity.service';
import { PostService } from '../post/post.service';
import { UserService } from '../user/user.service';
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
    pinSuccess: number;
    likes: number;
    posts: number;
  };
}

export interface ProfileActivityItemDto {
  id: string;
  title: string;
  date: string;
  location: string;
  price: number;
  image: string;
  status: 'registered';
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
  ) {}

  async onModuleInit() {
    const count = await this.registrationModel.estimatedDocumentCount();
    if (count === 0) {
      await this.registrationModel.insertMany(ACTIVITY_REGISTRATION_SEED);
    }
  }

  async getSummary(userId?: string, authorName?: string): Promise<ProfileSummaryDto> {
    const filter = resolveOwnerFilter(userId, authorName);
    const [profile, events, pinSuccess, likes, posts] = await Promise.all([
      this.userService.resolveProfile(userId, authorName),
      this.registrationRepository.countByOwner(filter),
      this.registrationRepository.countCompletedPinsByOwner(filter),
      this.postService.sumLikesByOwner(userId, authorName),
      this.postService.countByOwner(userId, authorName),
    ]);

    return {
      name: profile?.name ?? 'Zara Chen',
      handle: profile?.handle ?? '@zara',
      location: profile?.location ?? '上海',
      bio: profile?.bio ?? '电音爱好者',
      avatar:
        profile?.avatar ??
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
      stats: {
        events: events || 4,
        pinSuccess: pinSuccess || 8,
        likes: likes || 156,
        posts: posts || 4,
      },
    };
  }

  async listActivities(
    userId?: string,
    authorName?: string,
  ): Promise<ProfileActivityItemDto[]> {
    const filter = resolveOwnerFilter(userId, authorName);
    const registrations = await this.registrationRepository.findByOwner(filter);

    const items = await Promise.all(
      registrations.map(async registration => {
        const activity = await this.activityService.findByLegacyId(
          registration.activityLegacyId,
        );
        return {
          id: String(registration.activityLegacyId),
          title: activity?.name ?? `活动 ${registration.activityLegacyId}`,
          date: activity?.date ?? '',
          location: activity?.location ?? '',
          price: registration.price ?? 0,
          image: activity?.image ?? '',
          status: 'registered' as const,
        };
      }),
    );

    return items;
  }

  listPosts(userId?: string, authorName?: string) {
    return this.postService.listByOwner(userId, authorName);
  }
}
