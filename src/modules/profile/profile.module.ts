import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { UserModule } from '../user/user.module';
import { UserGoalSchema } from '../goal/goal.model';
import {
  ActivitySetVote,
  ActivitySetVoteSchema,
} from '../../database/schemas/activity-set-vote.schema';
import {
  UserItinerary,
  UserItinerarySchema,
} from '../../database/schemas/user-itinerary.schema';
import {
  UserTravelPlan,
  UserTravelPlanSchema,
} from '../../database/schemas/user-travel-plan.schema';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanSchema,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobSchema,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  ArtistPerformance,
  ArtistPerformanceSchema,
} from '../../database/schemas/artist-performance.schema';
import {
  UserArtistLike,
  UserArtistLikeSchema,
} from '../../database/schemas/user-artist-like.schema';
import { ProfileController } from './profile.controller';
import { ProfileSummaryService } from './profile-summary.service';
import { ProfileActivityEligibilityService } from './profile-activity-eligibility.service';

@Module({
  imports: [
    ActivityLookupModule,
    UserModule,
    MongooseModule.forFeature([
      { name: 'UserGoal', schema: UserGoalSchema },
      { name: ActivitySetVote.name, schema: ActivitySetVoteSchema },
      { name: UserItinerary.name, schema: UserItinerarySchema },
      { name: UserTravelPlan.name, schema: UserTravelPlanSchema },
      { name: TravelGuideSavedPlan.name, schema: TravelGuideSavedPlanSchema },
      {
        name: TravelGuideGenerationJob.name,
        schema: TravelGuideGenerationJobSchema,
      },
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
      { name: UserArtistLike.name, schema: UserArtistLikeSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileSummaryService, ProfileActivityEligibilityService],
  exports: [ProfileSummaryService, ProfileActivityEligibilityService],
})
export class ProfileModule {}
