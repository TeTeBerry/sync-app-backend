import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideVenueCache,
  TravelGuideVenueCacheDocument,
} from '../../../database/schemas/travel-guide-venue-cache.schema';
import { TRAVEL_GUIDE_HOT_ACTIVITIES } from './travel-guide-hot-path.data';

/** 将 Hot Path 场馆与枢纽路线写入 MongoDB，供多实例共享与运维查看 */
@Injectable()
export class TravelGuideVenueCacheSeedService implements OnModuleInit {
  private readonly logger = new Logger(TravelGuideVenueCacheSeedService.name);

  constructor(
    @InjectModel(TravelGuideVenueCache.name)
    private readonly model: Model<TravelGuideVenueCacheDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const profile of TRAVEL_GUIDE_HOT_ACTIVITIES) {
      await this.model.updateOne(
        { activityLegacyId: profile.activityLegacyId },
        {
          $set: {
            activityLegacyId: profile.activityLegacyId,
            activityCode: profile.activityCode,
            venue: profile.venue,
            readableAddress: profile.readableAddress,
            hubRoutes: profile.hubRoutes.map((h) => ({
              hubKey: h.hubKey,
              hubLabel: h.hubLabel,
              hubLat: h.hub.lat,
              hubLng: h.hub.lng,
              departureAliases: h.departureAliases,
              driving: h.driving,
              transitHint: h.transitHint,
              walkingHint: h.walkingHint,
            })),
          },
        },
        { upsert: true },
      );
    }
    this.logger.log(
      `Travel guide venue cache seeded for ${TRAVEL_GUIDE_HOT_ACTIVITIES.length} hot activities`,
    );
  }
}
