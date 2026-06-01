import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParserModule } from '../../ai/parser/parser.module';
import {
  TravelGuideVenueCache,
  TravelGuideVenueCacheSchema,
} from '../../database/schemas/travel-guide-venue-cache.schema';
import { ActivityModule } from '../activity/activity.module';
import { TencentMapService } from './map/tencent-map.service';
import { TravelGuideGeoCacheService } from './map/travel-guide-geo-cache.service';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { TravelGuideVenueCacheSeedService } from './map/travel-guide-venue-cache.seed';
import { TravelGuideController } from './travel-guide.controller';
import { TravelGuideMapController } from './travel-guide-map.controller';
import { TravelGuideGenerationService } from './travel-guide-generation.service';

@Module({
  imports: [
    ActivityModule,
    ParserModule,
    MongooseModule.forFeature([
      { name: TravelGuideVenueCache.name, schema: TravelGuideVenueCacheSchema },
    ]),
  ],
  controllers: [TravelGuideController, TravelGuideMapController],
  providers: [
    TencentMapService,
    TravelGuideGeoCacheService,
    TravelGuideVenueCacheSeedService,
    TravelGuidePoiCollector,
    TravelGuidePoiRanker,
    TravelGuideGenerationService,
  ],
})
export class TravelGuideModule {}
