import { Module } from '@nestjs/common';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { LiveInfoModule } from '../live-info/live-info.module';
import { TravelGuideModule } from '../travel-guide/travel-guide.module';
import { TravelPlanModule } from '../travel-plan/travel-plan.module';

/**
 * Logical aggregate for activity-scoped experience APIs:
 * `/api/activities/:legacyId/{travel-plan,itinerary,live-info,travel-guide}`
 */
@Module({
  imports: [
    TravelPlanModule,
    ItineraryModule,
    LiveInfoModule,
    TravelGuideModule,
  ],
  exports: [
    TravelPlanModule,
    ItineraryModule,
    LiveInfoModule,
    TravelGuideModule,
  ],
})
export class ActivityExperienceModule {}
