import { Module } from '@nestjs/common';
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
import { ArtistProfileResolver } from './artist-profile-resolver.service';
import { ItineraryGenerationService } from './itinerary-generation.service';
import { ItineraryCacheService } from './itinerary-cache.service';
import { LineupCatalogModule } from './lineup-catalog.module';
import { UserGoalModule } from '../goal/goal.module';

@Module({
  imports: [
    ActivityLookupModule,
    ActivityCatalogRefreshModule,
    LineupCatalogModule,
    AuthModule,
    CloudModule,
    DjModule,
    UserGoalModule,
    MongooseModule.forFeature([
      { name: UserArtistLike.name, schema: UserArtistLikeSchema },
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
      { name: FestivalSession.name, schema: FestivalSessionSchema },
      { name: UserItinerary.name, schema: UserItinerarySchema },
      {
        name: ItineraryGenerationLog.name,
        schema: ItineraryGenerationLogSchema,
      },
    ]),
  ],
  controllers: [ItineraryController, ArtistController],
  providers: [
    ArtistLikeService,
    ItineraryService,
    ItineraryScheduleService,
    ItineraryConflictService,
    ArtistProfileResolver,
    ItineraryGenerationService,
    ItineraryCacheService,
  ],
  exports: [ItineraryService, ItineraryScheduleService],
})
export class ItineraryModule {}
