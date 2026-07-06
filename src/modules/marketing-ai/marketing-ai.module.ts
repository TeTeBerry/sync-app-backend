import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { CloudModule } from '../../infra/cloud/cloud.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { MarketingAiController } from './marketing-ai.controller';
import { MarketingAiImageService } from './marketing-ai-image.service';
import { MarketingAiService } from './marketing-ai.service';
import { PosterFestivalCoverService } from './image-renderer/poster-festival-cover.service';
import { PosterImageRendererService } from './image-renderer/poster-image-renderer.service';

@Module({
  imports: [InfraLlmModule, CloudModule, ActivityLookupModule],
  controllers: [MarketingAiController],
  providers: [
    InternalApiKeyGuard,
    PosterImageRendererService,
    PosterFestivalCoverService,
    MarketingAiImageService,
    MarketingAiService,
  ],
  exports: [MarketingAiService, MarketingAiImageService],
})
export class MarketingAiModule {}
