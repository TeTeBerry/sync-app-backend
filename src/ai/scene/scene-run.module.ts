import { Module } from '@nestjs/common';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ActivityEngagementModule } from '../../modules/activity/engagement/activity-engagement.module';
import { ActivityLookupModule } from '../../modules/activity/activity-lookup.module';
import { EventsKnowledgeSearchService } from '../../modules/activity/application/events-knowledge-search.service';
import { LineupCatalogModule } from '../../modules/itinerary/lineup-catalog.module';
import { PartnerModule } from '../../modules/partner/partner.module';
import { UserModule } from '../../modules/user/user.module';
import { EventsKnowledgeSearchSceneHandler } from './handlers/events-knowledge-search.handler';
import { FestivalStorySceneHandler } from './handlers/festival-story.handler';
import { LineupDjSceneHandler } from './handlers/lineup-dj.handler';
import { RecruitApplyComposeSceneHandler } from './handlers/recruit-apply-compose.handler';
import { RecruitComposeSceneHandler } from './handlers/recruit-compose.handler';
import { RecruitSearchSceneHandler } from './handlers/recruit-search.handler';
import { SceneRunController } from './scene-run.controller';
import { SceneRunService } from './scene-run.service';

@Module({
  imports: [
    PartnerModule,
    UserModule,
    ActivityEngagementModule,
    ActivityLookupModule,
    LineupCatalogModule,
    InfraChromaModule,
    InfraLlmModule,
  ],
  controllers: [SceneRunController],
  providers: [
    EventsKnowledgeSearchService,
    RecruitSearchSceneHandler,
    RecruitComposeSceneHandler,
    RecruitApplyComposeSceneHandler,
    LineupDjSceneHandler,
    FestivalStorySceneHandler,
    EventsKnowledgeSearchSceneHandler,
    SceneRunService,
  ],
  exports: [
    SceneRunService,
    EventsKnowledgeSearchService,
    RecruitComposeSceneHandler,
  ],
})
export class SceneRunModule {}
