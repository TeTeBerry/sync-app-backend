import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { RedisService } from '../../redis/redis.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { ActivityRegistrationService } from '../activity/registration/activity-registration.service';
import { getActivityTypeLabel } from '../activity/utils/activity-type.util';

@Injectable()
export class HomeService {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly registrationService: ActivityRegistrationService,
    private readonly redisService: RedisService,
  ) {}

  async getSummary(actor: RequestActor) {
    const [activities, registeredLegacyIds] = await Promise.all([
      this.activityLookup.findAll(),
      this.registrationService.listRegisteredLegacyIds(actor),
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
      signupEvents,
      heat,
    };
  }
}
