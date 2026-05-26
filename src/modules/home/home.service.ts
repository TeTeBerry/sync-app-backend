import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly redisService: RedisService,
  ) {}

  async getSummary() {
    const activities = await this.activityService.findAll();

    const signupEvents = activities.map(item => ({
      id: item.legacyId,
      title: item.name,
      date: item.date ?? '',
      location: item.location ?? '',
      image: item.image ?? '',
      category: item.hot ? '户外电音' : 'EDM节',
      hot: Boolean(item.hot),
      attendees: item.attendees ?? 0,
      going: false,
    }));

    const totalAttendees = activities.reduce(
      (sum, activity) => sum + (activity.attendees ?? 0),
      0,
    );

    if (this.redisService.isEnabled()) {
      await Promise.all(
        activities.map(activity =>
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
