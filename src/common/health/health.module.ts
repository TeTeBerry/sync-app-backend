import { Module } from '@nestjs/common';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
import { RedisModule } from '../../redis/redis.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [RedisModule, InfraChromaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
