import { Module } from '@nestjs/common';
import { PublicApiRateLimitModule } from '../../common/rate-limit/public-api-rate-limit.module';
import { CloudModule } from '../../infra/cloud/cloud.module';
import { HunyuanImageClient } from '../../infra/llm/hunyuan-image.client';
import { PosterBackgroundController } from './poster-background.controller';
import { PosterBackgroundService } from './poster-background.service';

@Module({
  imports: [CloudModule, PublicApiRateLimitModule],
  controllers: [PosterBackgroundController],
  providers: [HunyuanImageClient, PosterBackgroundService],
})
export class PosterBackgroundModule {}
