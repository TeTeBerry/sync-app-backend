import { Global, Module } from '@nestjs/common';
import {
  BffReadCacheInvalidationService,
  FestivalPlanProgressCacheService,
  HomeSummaryCacheService,
} from './bff-read-cache.service';
import { RedisMemoryJsonCacheService } from './redis-memory-json-cache.service';

@Global()
@Module({
  providers: [
    RedisMemoryJsonCacheService,
    HomeSummaryCacheService,
    FestivalPlanProgressCacheService,
    BffReadCacheInvalidationService,
  ],
  exports: [
    RedisMemoryJsonCacheService,
    HomeSummaryCacheService,
    FestivalPlanProgressCacheService,
    BffReadCacheInvalidationService,
  ],
})
export class CacheModule {}
