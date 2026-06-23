import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthModule } from '../modules/auth/auth.module';
import { MediaSecurityModule } from '../modules/media-security/media-security.module';
import { ActivityModule } from '../modules/activity/activity.module';
import { ChatModule } from '../modules/chat/chat.module';
import { PartnerAgentPortsModule } from '../modules/partner/partner-agent-ports.module';
import { ItineraryAgentPortsModule } from '../modules/itinerary/itinerary-agent-ports.module';
import { HandlerModule } from './handlers/handler.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { InfraLlmModule } from '../infra/llm/llm.module';
import { AgentsModule } from './agents/agents.module';
import { BuddyModule } from './buddy/buddy.module';
import { IntentRouterModule } from './intent/intent-router.module';
import { DjInfoModule } from './dj/dj-info.module';
import { ChatAgentModule } from './agent/chat-agent.module';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AiTurnPipeline } from './orchestration/ai-turn.pipeline';
import { PostingTurnOrchestrator } from './orchestration/posting-turn.orchestrator';
import { AgentTurnHandler } from './orchestration/handlers/agent-turn.handler';
import { ReadOnlyTurnHandler } from './orchestration/handlers/read-only-turn.handler';
import { DjInfoTurnHandler } from './orchestration/handlers/dj-info-turn.handler';
import { LegacyTurnHandler } from './orchestration/handlers/legacy-turn.handler';
import { AiStreamEventBuilder } from './presentation/ai-stream-event.builder';
import { AiChatWsHandler } from './ws/ai-chat-ws.handler';
import { AiChatWsServer } from './ws/ai-chat-ws.server';

@Module({
  imports: [
    AuthModule,
    MediaSecurityModule,
    ActivityModule,
    ChatModule,
    PartnerAgentPortsModule,
    HandlerModule,
    OrchestrationModule,
    InfraLlmModule,
    AgentsModule,
    IntentRouterModule,
    BuddyModule,
    DjInfoModule,
    ItineraryAgentPortsModule,
    ChatAgentModule,
  ],
  providers: [
    AiService,
    AiRateLimitService,
    AiTurnPipeline,
    PostingTurnOrchestrator,
    AgentTurnHandler,
    ReadOnlyTurnHandler,
    DjInfoTurnHandler,
    LegacyTurnHandler,
    AiStreamEventBuilder,
    AiChatWsHandler,
    AiChatWsServer,
  ],
})
export class AiModule {}
