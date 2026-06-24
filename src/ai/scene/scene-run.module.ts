import { Module } from '@nestjs/common';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ActivityLookupModule } from '../../modules/activity/activity-lookup.module';
import { EventsKnowledgeSearchService } from '../../modules/activity/application/events-knowledge-search.service';
import { PartnerModule } from '../../modules/partner/partner.module';
import { UserModule } from '../../modules/user/user.module';
import { EventsKnowledgeSearchSceneHandler } from './handlers/events-knowledge-search.handler';
import { RecruitSearchSceneHandler } from './handlers/recruit-search.handler';
import { SceneRunController } from './scene-run.controller';
import { SceneRunService } from './scene-run.service';

@Module({
  imports: [
    PartnerModule,
    UserModule,
    ActivityLookupModule,
    InfraChromaModule,
    InfraLlmModule,
  ],
  controllers: [SceneRunController],
  providers: [
    EventsKnowledgeSearchService,
    RecruitSearchSceneHandler,
    EventsKnowledgeSearchSceneHandler,
    SceneRunService,
  ],
  exports: [SceneRunService],
})
export class SceneRunModule {}
