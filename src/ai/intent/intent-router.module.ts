import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { ParserModule } from '../parser/parser.module';
import { IntentCacheService } from './intent-cache.service';
import { IntentRouterService } from './intent-router.service';

@Module({
  imports: [ActivityModule, ParserModule],
  providers: [IntentCacheService, IntentRouterService],
  exports: [IntentCacheService, IntentRouterService],
})
export class IntentRouterModule {}
