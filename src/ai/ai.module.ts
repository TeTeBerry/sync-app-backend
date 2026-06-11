import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthModule } from '../modules/auth/auth.module';
import { ActivityModule } from '../modules/activity/activity.module';
import { ChatModule } from '../modules/chat/chat.module';
import { PartnerModule } from '../modules/partner/partner.module';
import { InfraChromaModule } from '../infra/chroma/chroma.module';
import { RagModule } from './rag/rag.module';
import { HandlerModule } from './handlers/handler.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { InfraLlmModule } from '../infra/llm/llm.module';
import { AgentsModule } from './agents/agents.module';
import { PostAgentAdaptersModule } from './adapters/post-agent-adapters.module';
import { BuddyModule } from './buddy/buddy.module';
import { IntentRouterModule } from './intent/intent-router.module';
import { DjInfoModule } from './dj/dj-info.module';
import { ChatAgentModule } from './agent/chat-agent.module';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AiTurnPipeline } from './orchestration/ai-turn.pipeline';
import { PostingTurnOrchestrator } from './orchestration/posting-turn.orchestrator';
import { AgentFirstTurnHandler } from './orchestration/handlers/agent-first-turn.handler';
import { DjInfoTurnHandler } from './orchestration/handlers/dj-info-turn.handler';
import { AiStreamEventBuilder } from './presentation/ai-stream-event.builder';
import { AiChatWsHandler } from './ws/ai-chat-ws.handler';
import { AiChatWsServer } from './ws/ai-chat-ws.server';

@Module({
  imports: [
    AuthModule,
    ActivityModule,
    ChatModule,
    PartnerModule,
    InfraChromaModule,
    RagModule,
    HandlerModule,
    OrchestrationModule,
    InfraLlmModule,
    AgentsModule,
    IntentRouterModule,
    BuddyModule,
    DjInfoModule,
    ChatAgentModule,
  ],
  providers: [
    AiService,
    AiRateLimitService,
    AiTurnPipeline,
    PostingTurnOrchestrator,
    AgentFirstTurnHandler,
    DjInfoTurnHandler,
    AiStreamEventBuilder,
    AiChatWsHandler,
    AiChatWsServer,
  ],
})
export class AiModule {}
