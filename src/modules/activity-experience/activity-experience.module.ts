import { Module } from '@nestjs/common';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { TravelGuideModule } from '../travel-guide/travel-guide.module';
import { TravelPlanModule } from '../travel-plan/travel-plan.module';

/**
 * Logical aggregate for activity-scoped experience APIs:
 * `/api/activities/:legacyId/{travel-plan,itinerary,travel-guide}`
 */
@Module({
  imports: [TravelPlanModule, ItineraryModule, TravelGuideModule],
  exports: [TravelPlanModule, ItineraryModule, TravelGuideModule],
})
export class ActivityExperienceModule {}
