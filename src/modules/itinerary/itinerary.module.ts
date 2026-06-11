import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { DjModule } from '../dj/dj.module';
import { PartnerRepositoryModule } from '../partner/partner-repository.module';
import { ItineraryController } from './itinerary.controller';
import { ItineraryService } from './itinerary.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';
import { ItineraryGenerationService } from './itinerary-generation.service';
import { ItineraryCacheService } from './itinerary-cache.service';
import { ItineraryBuddyRecruitHintService } from './itinerary-buddy-recruit-hint.service';

@Module({
  imports: [
    ActivityModule,
    AuthModule,
    DjModule,
    PartnerRepositoryModule,
    MongooseModule.forFeature([
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
      { name: FestivalSession.name, schema: FestivalSessionSchema },
      { name: UserItinerary.name, schema: UserItinerarySchema },
      {
        name: ItineraryGenerationLog.name,
        schema: ItineraryGenerationLogSchema,
      },
    ]),
  ],
  controllers: [ItineraryController],
  providers: [
    ItineraryService,
    ItineraryScheduleService,
    ItineraryGenerationService,
    ItineraryCacheService,
    ItineraryBuddyRecruitHintService,
  ],
  exports: [ItineraryService, ItineraryScheduleService],
})
export class ItineraryModule {}
