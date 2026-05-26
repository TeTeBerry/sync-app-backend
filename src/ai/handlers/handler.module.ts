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
import {
  StructuredReplyHandler,
  StructuredReplyMatcher,
  StructuredReplyPlanner,
  StructuredReplyExecutor,
  StructuredReplyComposer,
} from './structured-reply';

@Module({
  imports: [ActivityModule],
  providers: [
    QuickReplyMatcher,
    QuickReplyPlanner,
    QuickReplyExecutor,
    QuickReplyComposer,
    StructuredReplyMatcher,
    StructuredReplyPlanner,
    StructuredReplyExecutor,
    StructuredReplyComposer,
    QuickReplyHandler,
    StructuredReplyHandler,
    {
      provide: HANDLER_REGISTRY_TOKEN,
      useFactory: (
        quickReply: QuickReplyHandler,
        structuredReply: StructuredReplyHandler,
      ) => [quickReply, structuredReply],
      inject: [QuickReplyHandler, StructuredReplyHandler],
    },
    HandlerRegistryService,
  ],
  exports: [HandlerRegistryService],
})
export class HandlerModule {}
