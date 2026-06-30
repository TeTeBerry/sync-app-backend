import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentsModule } from '../../ai/agents/agents.module';
import { ActivityModule } from '../activity/activity.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { UserContextModule } from '../activity/context/user-context.module';
import { PartnerModule } from '../partner/partner.module';
import { NotificationModule } from './notification.module';
import { ProactiveNudgeService } from './proactive-nudge.service';

@Module({
  imports: [
    ScheduleModule,
    UserContextModule,
    ActivityModule,
    ActivityLookupModule,
    PartnerModule,
    NotificationModule,
    AgentsModule,
  ],
  providers: [ProactiveNudgeService],
  exports: [ProactiveNudgeService],
})
export class ProactiveNudgeModule {}
