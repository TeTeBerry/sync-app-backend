import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import {
  ArtistPerformance,
  ArtistPerformanceSchema,
} from '../../database/schemas/artist-performance.schema';
import { CloudModule } from '../../infra/cloud/cloud.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { HunyuanImageClient } from '../../infra/llm/hunyuan-image.client';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { DjModule } from '../dj/dj.module';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
import { MarketingAiController } from './marketing-ai.controller';
import { MarketingAiImageService } from './marketing-ai-image.service';
import { MarketingAiService } from './marketing-ai.service';
import { MarketingContentContextService } from './marketing-content-context.service';
import { MarketingFestivalsService } from './marketing-festivals.service';
import { MarketingPosterBackgroundService } from './image-renderer/marketing-poster-background.service';
import { PosterImageRendererService } from './image-renderer/poster-image-renderer.service';

@Module({
  imports: [
    InfraLlmModule,
    CloudModule,
    ActivityLookupModule,
    LineupCatalogModule,
    DjModule,
    MongooseModule.forFeature([
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
    ]),
  ],
  controllers: [MarketingAiController],
  providers: [
    InternalApiKeyGuard,
    HunyuanImageClient,
    PosterImageRendererService,
    MarketingPosterBackgroundService,
    MarketingAiImageService,
    MarketingContentContextService,
    MarketingAiService,
    MarketingFestivalsService,
  ],
  exports: [MarketingAiService, MarketingAiImageService],
})
export class MarketingAiModule {}
