import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { ParserModule } from '../parser/parser.module';
import { IntentRouterService } from './intent-router.service';

@Module({
  imports: [ActivityModule, ParserModule],
  providers: [IntentRouterService],
  exports: [IntentRouterService],
})
export class IntentRouterModule {}
