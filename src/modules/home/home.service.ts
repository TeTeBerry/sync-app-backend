import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { ActivityService } from '../activity/activity.service';
import { ActivityRegistrationService } from '../activity/registration/activity-registration.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly registrationService: ActivityRegistrationService,
    private readonly redisService: RedisService,
  ) {}

  async getSummary(userId?: string, authorName?: string) {
    const [activities, registeredLegacyIds] = await Promise.all([
      this.activityService.findAll(),
      this.registrationService.listRegisteredLegacyIds(userId, authorName),
    ]);

    const signupEvents = activities.map((item) => ({
      id: item.legacyId,
      title: item.name,
      date: item.date ?? '',
      location: item.location ?? '',
      image: item.image ?? '',
      category: item.hot ? '户外电音' : 'EDM节',
      hot: Boolean(item.hot),
      attendees: item.attendees ?? 0,
      going: registeredLegacyIds.has(item.legacyId),
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

    return {
      heat,
      signupEvents,
    };
  }
}
