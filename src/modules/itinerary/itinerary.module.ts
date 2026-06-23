import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudModule } from '../../infra/cloud/cloud.module';
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
import {
  LineupArtistAvatar,
  LineupArtistAvatarSchema,
} from '../../database/schemas/lineup-artist-avatar.schema';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { DjModule } from '../dj/dj.module';
import { ItineraryController } from './itinerary.controller';
import { ArtistController } from './artist.controller';
import { ItineraryService } from './itinerary.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';
import { ItineraryGenerationService } from './itinerary-generation.service';
import { ItineraryCacheService } from './itinerary-cache.service';
import { LineupArtistAvatarService } from './lineup-artist-avatar.service';

@Module({
  imports: [
    forwardRef(() => ActivityModule),
    AuthModule,
    CloudModule,
    DjModule,
    MongooseModule.forFeature([
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
      { name: FestivalSession.name, schema: FestivalSessionSchema },
      { name: UserItinerary.name, schema: UserItinerarySchema },
      {
        name: ItineraryGenerationLog.name,
        schema: ItineraryGenerationLogSchema,
      },
      { name: LineupArtistAvatar.name, schema: LineupArtistAvatarSchema },
    ]),
  ],
  controllers: [ItineraryController, ArtistController],
  providers: [
    ItineraryService,
    ItineraryScheduleService,
    ItineraryGenerationService,
    ItineraryCacheService,
    LineupArtistAvatarService,
  ],
  exports: [ItineraryService, ItineraryScheduleService],
})
export class ItineraryModule {}
