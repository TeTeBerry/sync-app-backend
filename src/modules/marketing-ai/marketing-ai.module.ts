import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { MarketingAiController } from './marketing-ai.controller';
import { MarketingAiService } from './marketing-ai.service';

@Module({
  imports: [InfraLlmModule],
  controllers: [MarketingAiController],
  providers: [InternalApiKeyGuard, MarketingAiService],
  exports: [MarketingAiService],
})
export class MarketingAiModule {}
