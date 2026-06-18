import { Global, Module } from '@nestjs/common';
import { PublicApiRateLimitService } from './public-api-rate-limit.service';
import { RedisModule } from '../../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [PublicApiRateLimitService],
  exports: [PublicApiRateLimitService],
})
export class PublicApiRateLimitModule {}
