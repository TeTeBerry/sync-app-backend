import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudModule } from '../../infra/cloud/cloud.module';
import {
  UserArtistLike,
  UserArtistLikeSchema,
} from '../../database/schemas/user-artist-like.schema';
import {
  ArtistPerformance,
  ArtistPerformanceSchema,
} from '../../database/schemas/artist-performance.schema';
import {
  FestivalSession,
  FestivalSessionSchema,
} from '../../database/schemas/festival-session.schema';
import {
  UserItinerary,
  UserItinerarySchema,
} from '../../database/schemas/user-itinerary.schema';
import {
  ItineraryGenerationLog,
  ItineraryGenerationLogSchema,
} from '../../database/schemas/itinerary-generation-log.schema';
import { ActivityCatalogRefreshModule } from '../activity/activity-catalog-refresh.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { AuthModule } from '../auth/auth.module';
import { DjModule } from '../dj/dj.module';
import { ItineraryController } from './itinerary.controller';
import { ArtistController } from './artist.controller';
import { ArtistLikeService } from './artist-like.service';
import { ItineraryService } from './itinerary.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';
import { ItineraryConflictService } from './itinerary-conflict.service';
import { LineupConflictService } from './lineup-conflict.service';
import { StageTransferService } from './stage-transfer.service';
import { ScheduleOverlapService } from './schedule-overlap.service';
import { ClashResolutionService } from './clash-resolution.service';
import {
  UserLineupClashState,
  UserLineupClashStateSchema,
} from '../../database/schemas/user-lineup-clash-state.schema';
import { ArtistProfileResolver } from './artist-profile-resolver.service';
import { ItineraryGenerationService } from './itinerary-generation.service';
import { ItineraryCacheService } from './itinerary-cache.service';
import { LineupCatalogModule } from './lineup-catalog.module';
import { UserGoalModule } from '../goal/goal.module';
import { TripPlanModule } from '../trip-plan/trip-plan.module';

@Module({
  imports: [
    ActivityLookupModule,
    ActivityCatalogRefreshModule,
    LineupCatalogModule,
    AuthModule,
    CloudModule,
    DjModule,
    UserGoalModule,
    forwardRef(() => TripPlanModule),
    MongooseModule.forFeature([
      { name: UserArtistLike.name, schema: UserArtistLikeSchema },
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
      { name: FestivalSession.name, schema: FestivalSessionSchema },
      { name: UserItinerary.name, schema: UserItinerarySchema },
      {
        name: ItineraryGenerationLog.name,
        schema: ItineraryGenerationLogSchema,
      },
      {
        name: UserLineupClashState.name,
        schema: UserLineupClashStateSchema,
      },
    ]),
  ],
  controllers: [ItineraryController, ArtistController],
  providers: [
    ArtistLikeService,
    ItineraryService,
    ItineraryScheduleService,
    ItineraryConflictService,
    StageTransferService,
    ScheduleOverlapService,
    LineupConflictService,
    ClashResolutionService,
    ArtistProfileResolver,
    ItineraryGenerationService,
    ItineraryCacheService,
  ],
  exports: [
    ItineraryService,
    ItineraryScheduleService,
    ArtistLikeService,
    LineupConflictService,
    ClashResolutionService,
    StageTransferService,
    ScheduleOverlapService,
  ],
})
export class ItineraryModule {}
