import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { HunyuanImageClient } from '../../infra/llm/hunyuan-image.client';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { MarketingAiController } from './marketing-ai.controller';
import { MarketingAiImageService } from './marketing-ai-image.service';
import { MarketingAiService } from './marketing-ai.service';

@Module({
  imports: [InfraLlmModule],
  controllers: [MarketingAiController],
  providers: [
    InternalApiKeyGuard,
    HunyuanImageClient,
    MarketingAiImageService,
    MarketingAiService,
  ],
  exports: [MarketingAiService, MarketingAiImageService],
})
export class MarketingAiModule {}
