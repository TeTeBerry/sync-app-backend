import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { CloudModule } from '../../infra/cloud/cloud.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
import { MarketingAiController } from './marketing-ai.controller';
import { MarketingAiImageService } from './marketing-ai-image.service';
import { MarketingAiService } from './marketing-ai.service';
import { MarketingFestivalsService } from './marketing-festivals.service';
import { MarketingPosterBackgroundService } from './image-renderer/marketing-poster-background.service';
import { PosterImageRendererService } from './image-renderer/poster-image-renderer.service';
import { HunyuanImageClient } from '../../infra/llm/hunyuan-image.client';

@Module({
  imports: [
    InfraLlmModule,
    CloudModule,
    ActivityLookupModule,
    LineupCatalogModule,
  ],
  controllers: [MarketingAiController],
  providers: [
    InternalApiKeyGuard,
    HunyuanImageClient,
    PosterImageRendererService,
    MarketingPosterBackgroundService,
    MarketingAiImageService,
    MarketingAiService,
    MarketingFestivalsService,
  ],
  exports: [MarketingAiService, MarketingAiImageService],
})
export class MarketingAiModule {}
