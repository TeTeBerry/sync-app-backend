import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TripPlan,
  TripPlanSchema,
} from '../../database/schemas/trip-plan.schema';
import {
  TripMemberOverlay,
  TripMemberOverlaySchema,
} from '../../database/schemas/trip-member-overlay.schema';
import {
  UserTravelPlan,
  UserTravelPlanSchema,
} from '../../database/schemas/user-travel-plan.schema';
import {
  UserItinerary,
  UserItinerarySchema,
} from '../../database/schemas/user-itinerary.schema';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobSchema,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanSchema,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import { TripPlanController } from './trip-plan.controller';
import { TripPlanService } from './trip-plan.service';
import { TripPlanCollaborationService } from './trip-plan-collaboration.service';
import { TripPlanOverlayService } from './trip-plan-overlay.service';
import { TripPlanSummaryService } from './trip-plan-summary.service';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { UserGoalModule } from '../goal/goal.module';

@Module({
  imports: [
    forwardRef(() => ItineraryModule),
    UserGoalModule,
    MongooseModule.forFeature([
      { name: TripPlan.name, schema: TripPlanSchema },
      { name: TripMemberOverlay.name, schema: TripMemberOverlaySchema },
      { name: UserTravelPlan.name, schema: UserTravelPlanSchema },
      { name: UserItinerary.name, schema: UserItinerarySchema },
      {
        name: TravelGuideGenerationJob.name,
        schema: TravelGuideGenerationJobSchema,
      },
      {
        name: TravelGuideSavedPlan.name,
        schema: TravelGuideSavedPlanSchema,
      },
    ]),
  ],
  controllers: [TripPlanController],
  providers: [
    TripPlanService,
    TripPlanCollaborationService,
    TripPlanOverlayService,
    TripPlanSummaryService,
  ],
  exports: [
    TripPlanService,
    TripPlanCollaborationService,
    TripPlanOverlayService,
    TripPlanSummaryService,
  ],
})
export class TripPlanModule {}
