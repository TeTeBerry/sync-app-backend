import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { HomeSummaryCacheService } from '../../infra/cache/bff-read-cache.service';
import { RedisService } from '../../redis/redis.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { ActivityRegistrationService } from '../activity/registration/activity-registration.service';
import { NotificationService } from '../notification/notification.service';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../partner/interfaces/post.repository.interface';
import {
  POST_READ_PORT,
  type IPostReadPort,
} from '../partner/ports/post-read.port';
import { getActivityTypeLabel } from '../activity/utils/activity-type.util';
import { pickNextRegisteredSignupEvent } from './utils/pick-next-signup-event.util';

/** Matches frontend `HOME_POPULAR_POSTS_PERSIST_LIMIT`. */
const HOME_POPULAR_POSTS_LIMIT = 8;

export type MyNextEventPostEngagement = {
  activityLegacyId: number;
  postId: string;
  unreadReplyCount: number;
};

@Injectable()
export class HomeService {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly registrationService: ActivityRegistrationService,
    private readonly redisService: RedisService,
    @Inject(POST_READ_PORT)
    private readonly postRead: IPostReadPort,
    @Inject(POST_REPOSITORY)
    private readonly postRepository: IPostRepository,
    private readonly notificationService: NotificationService,
    private readonly homeSummaryCache: HomeSummaryCacheService,
  ) {}

  async getSummary(actor: RequestActor) {
    const userId = actor.resolvedUserId?.trim();
    if (userId) {
      const cached = await this.homeSummaryCache.get(userId);
      if (cached) {
        return cached;
      }
    }

    const summary = await this.buildSummary(actor);
    if (userId) {
      await this.homeSummaryCache.set(userId, summary);
    }
    return summary;
  }

  private async buildSummary(actor: RequestActor) {
    const [activities, registeredLegacyIds, popularPosts] = await Promise.all([
      this.activityLookup.findAll(),
      this.registrationService.listRegisteredLegacyIds(actor),
      this.postRead.listPopular(HOME_POPULAR_POSTS_LIMIT, actor),
    ]);

    const signupEvents = activities.map((item) => ({
      id: item.legacyId,
      title: item.name,
      date: item.date ?? '',
      location: item.location ?? '',
      image: item.image ?? '',
      category: getActivityTypeLabel(item.activityType),
      hot: Boolean(item.hot),
      attendees: item.attendees ?? 0,
      going: registeredLegacyIds.has(item.legacyId),
      region: item.region,
      area: item.area,
    }));

    const totalAttendees = activities.reduce(
      (sum, activity) => sum + (activity.attendees ?? 0),
      0,
    );

    if (this.redisService.isEnabled()) {
      await Promise.all(
        activities.map((activity) =>
          this.redisService.setActivityHeat(
            activity.legacyId,
            activity.attendees ?? 0,
          ),
        ),
      );
    }

    const heat = await this.redisService.getHeat(totalAttendees);
    const myNextEventPostEngagement =
      await this.resolveMyNextEventPostEngagement(actor, signupEvents);

    return {
      signupEvents,
      heat,
      popularPosts,
      myNextEventPostEngagement,
    };
  }

  private async resolveMyNextEventPostEngagement(
    actor: RequestActor,
    signupEvents: Array<{
      id: number;
      title: string;
      date: string;
      going: boolean;
    }>,
  ): Promise<MyNextEventPostEngagement | null> {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) return null;

    const nextEvent = pickNextRegisteredSignupEvent(signupEvents);
    if (!nextEvent) return null;

    const userPosts = await this.postRepository.findByOwner({
      userId,
      activityLegacyId: nextEvent.id,
      status: 'active',
    });
    if (!userPosts.length) return null;

    const postIds = userPosts.map((post) => String(post._id));
    const unreadReplyCount =
      await this.notificationService.countUnreadPostEngagement(userId, postIds);
    if (unreadReplyCount <= 0) return null;

    return {
      activityLegacyId: nextEvent.id,
      postId: postIds[0],
      unreadReplyCount,
    };
  }
}
