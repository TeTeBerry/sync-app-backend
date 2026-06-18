import { Global, Module } from '@nestjs/common';
import { RedisMemoryJsonCacheService } from './redis-memory-json-cache.service';

@Global()
@Module({
  providers: [RedisMemoryJsonCacheService],
  exports: [RedisMemoryJsonCacheService],
})
export class CacheModule {}
