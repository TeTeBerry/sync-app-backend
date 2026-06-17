import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { ItineraryModule } from '../../modules/itinerary/itinerary.module';
import { PartnerModule } from '../../modules/partner/partner.module';
import { PersonalityTestModule } from '../../modules/personality-test/personality-test.module';
import { ProfileModule } from '../../modules/profile/profile.module';
import { TravelGuideModule } from '../../modules/travel-guide/travel-guide.module';
import { BuddyModule } from '../buddy/buddy.module';
import { DjInfoModule } from '../dj/dj-info.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { AiStreamEventBuilder } from '../presentation/ai-stream-event.builder';
import { ActivityRegistrationAgentToolService } from './activity-registration-agent-tool.service';
import { AgentLlmService } from './agent-llm.service';
import { ChatAgentOrchestratorService } from './chat-agent-orchestrator.service';
import { ChatAgentToolRegistry } from './chat-agent-tool.registry';
import { ItineraryAgentToolService } from './itinerary-agent-tool.service';
import { PersonalityTestAgentToolService } from './personality-test-agent-tool.service';
import { PostAgentToolService } from './post-agent-tool.service';
import { PostCommentAgentToolService } from './post-comment-agent-tool.service';
import { ProfileAgentToolService } from './profile-agent-tool.service';
import { TravelGuideAgentToolService } from './travel-guide-agent-tool.service';
import {
  ActivityRegisterTool,
  ActivityUnregisterTool,
} from './tools/activity-registration.tools';
import { GetActivityBriefTool } from './tools/get-activity-brief.tool';
import { GetFestivalInfoTool } from './tools/get-festival-info.tool';
import {
  ItineraryCollectAndGenerateTool,
  ItineraryGenerateTool,
  ItineraryGetScheduleTool,
  ItineraryOpenSheetTool,
} from './tools/itinerary.tools';
import {
  PersonalityTestGetResultTool,
  PersonalityTestOpenTool,
} from './tools/personality-test.tools';
import { PostConfirmPublishTool } from './tools/post-confirm-publish.tool';
import {
  PostAddCommentTool,
  PostListCommentsTool,
} from './tools/post-comment.tools';
import { PostStartCollectTool } from './tools/post-start-collect.tool';
import { PostSubmitTool } from './tools/post-submit.tool';
import {
  ProfileGetSummaryTool,
  ProfileListRegistrationsTool,
} from './tools/profile.tools';
import { QueryDjInfoTool } from './tools/query-dj-info.tool';
import { TravelGuideCollectSlotsTool } from './tools/travel-guide-collect-slots.tool';
import { TravelGuideGenerateTool } from './tools/travel-guide-generate.tool';

@Module({
  imports: [
    ActivityModule,
    DjInfoModule,
    InfraLlmModule,
    BuddyModule,
    TravelGuideModule,
    ItineraryModule,
    PersonalityTestModule,
    ProfileModule,
    PartnerModule,
  ],
  providers: [
    AiStreamEventBuilder,
    AgentLlmService,
    PostAgentToolService,
    TravelGuideAgentToolService,
    ProfileAgentToolService,
    ActivityRegistrationAgentToolService,
    PersonalityTestAgentToolService,
    ItineraryAgentToolService,
    PostCommentAgentToolService,
    ChatAgentToolRegistry,
    QueryDjInfoTool,
    GetFestivalInfoTool,
    GetActivityBriefTool,
    PostStartCollectTool,
    PostSubmitTool,
    PostConfirmPublishTool,
    TravelGuideCollectSlotsTool,
    TravelGuideGenerateTool,
    ProfileGetSummaryTool,
    ProfileListRegistrationsTool,
    ActivityRegisterTool,
    ActivityUnregisterTool,
    PersonalityTestGetResultTool,
    PersonalityTestOpenTool,
    ItineraryGetScheduleTool,
    ItineraryOpenSheetTool,
    ItineraryCollectAndGenerateTool,
    ItineraryGenerateTool,
    PostListCommentsTool,
    PostAddCommentTool,
    ChatAgentOrchestratorService,
  ],
  exports: [ChatAgentOrchestratorService],
})
export class ChatAgentModule {}
