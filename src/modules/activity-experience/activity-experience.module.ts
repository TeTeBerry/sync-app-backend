import { Module } from '@nestjs/common';
import { FestivalPlanModule } from '../festival-plan/festival-plan.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { TravelGuideModule } from '../travel-guide/travel-guide.module';
import { TravelPlanModule } from '../travel-plan/travel-plan.module';

/**
 * Logical aggregate for activity-scoped experience APIs:
 * `/api/activities/:legacyId/{travel-plan,itinerary,travel-guide,festival-plan-progress}`
 */
@Module({
  imports: [
    TravelPlanModule,
    ItineraryModule,
    TravelGuideModule,
    FestivalPlanModule,
  ],
  exports: [
    TravelPlanModule,
    ItineraryModule,
    TravelGuideModule,
    FestivalPlanModule,
  ],
})
export class ActivityExperienceModule {}
