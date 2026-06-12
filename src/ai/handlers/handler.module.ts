import { Module } from '@nestjs/common';
import {
  HandlerRegistryService,
  HANDLER_REGISTRY_TOKEN,
} from '../handler-pipeline';
import { ActivityModule } from '../../modules/activity/activity.module';
import {
  QuickReplyHandler,
  QuickReplyMatcher,
  QuickReplyPlanner,
  QuickReplyExecutor,
  QuickReplyComposer,
} from './quick-reply';

@Module({
  imports: [ActivityModule],
  providers: [
    QuickReplyMatcher,
    QuickReplyPlanner,
    QuickReplyExecutor,
    QuickReplyComposer,
    QuickReplyHandler,
    {
      provide: HANDLER_REGISTRY_TOKEN,
      useFactory: (quickReply: QuickReplyHandler) => [quickReply],
      inject: [QuickReplyHandler],
    },
    HandlerRegistryService,
  ],
  exports: [HandlerRegistryService],
})
export class HandlerModule {}
