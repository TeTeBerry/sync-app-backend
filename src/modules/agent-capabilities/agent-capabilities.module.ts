import { Module } from '@nestjs/common';
import { PublicApiRateLimitModule } from '../../common/rate-limit/public-api-rate-limit.module';
import { SceneRunModule } from '../../ai/scene/scene-run.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { ActivityModule } from '../activity/activity.module';
import { UserGoalModule } from '../goal/goal.module';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
import { TravelGuideModule } from '../travel-guide/travel-guide.module';
import { AgentCapabilitiesController } from './agent-capabilities.controller';
import { AgentCapabilitiesService } from './agent-capabilities.service';

@Module({
  imports: [
    SceneRunModule,
    ActivityLookupModule,
    ActivityModule,
    LineupCatalogModule,
    TravelGuideModule,
    UserGoalModule,
    PublicApiRateLimitModule,
  ],
  controllers: [AgentCapabilitiesController],
  providers: [AgentCapabilitiesService],
  exports: [AgentCapabilitiesService],
})
export class AgentCapabilitiesModule {}
