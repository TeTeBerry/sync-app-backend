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
import { PosterFestivalCoverService } from './image-renderer/poster-festival-cover.service';
import { PosterImageRendererService } from './image-renderer/poster-image-renderer.service';

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
    PosterImageRendererService,
    PosterFestivalCoverService,
    MarketingAiImageService,
    MarketingAiService,
    MarketingFestivalsService,
  ],
  exports: [MarketingAiService, MarketingAiImageService],
})
export class MarketingAiModule {}
