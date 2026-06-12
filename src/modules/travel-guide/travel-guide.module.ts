import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import {
  TravelGuideGenerationCache,
  TravelGuideGenerationCacheSchema,
} from '../../database/schemas/travel-guide-generation-cache.schema';
import {
  TravelGuideVenueCache,
  TravelGuideVenueCacheSchema,
} from '../../database/schemas/travel-guide-venue-cache.schema';
import { ActivityModule } from '../activity/activity.module';
import { WechatMiniModule } from '../auth/wechat-mini.module';
import { UserModule } from '../user/user.module';
import { AmapMapService } from './map/amap.service';
import { TravelGuideGeoCacheService } from './map/travel-guide-geo-cache.service';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { TravelGuideVenueCacheSeedService } from './map/travel-guide-venue-cache.seed';
import { TravelGuideController } from './travel-guide.controller';
import { TravelGuideMapController } from './travel-guide-map.controller';
import { TravelGuideGenerationCacheService } from './travel-guide-generation-cache.service';
import { TravelGuideGenerationService } from './travel-guide-generation.service';

@Module({
  imports: [
    ActivityModule,
    WechatMiniModule,
    UserModule,
    InfraLlmModule,
    MongooseModule.forFeature([
      { name: TravelGuideVenueCache.name, schema: TravelGuideVenueCacheSchema },
      {
        name: TravelGuideGenerationCache.name,
        schema: TravelGuideGenerationCacheSchema,
      },
    ]),
  ],
  controllers: [TravelGuideController, TravelGuideMapController],
  providers: [
    AmapMapService,
    TravelGuideGeoCacheService,
    TravelGuideVenueCacheSeedService,
    TravelGuidePoiCollector,
    TravelGuidePoiRanker,
    TravelGuideGenerationCacheService,
    TravelGuideGenerationService,
  ],
})
export class TravelGuideModule {}
