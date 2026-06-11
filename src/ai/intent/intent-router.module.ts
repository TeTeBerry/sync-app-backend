import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { IntentCacheService } from './intent-cache.service';
import { IntentRouterService } from './intent-router.service';

@Module({
  imports: [ActivityModule, InfraLlmModule],
  providers: [IntentCacheService, IntentRouterService],
  exports: [IntentCacheService, IntentRouterService],
})
export class IntentRouterModule {}
