import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ActivityModule } from '../modules/activity/activity.module';
import { ProfileModule } from '../modules/profile/profile.module';
import { ChatModule } from '../modules/chat/chat.module';
import { PostModule } from '../modules/post/post.module';
import { ChromaModule } from './rag/chroma.module';
import { RagModule } from './rag/rag.module';
import { HandlerModule } from './handlers/handler.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { ParserModule } from './parser/parser.module';
import { AgentsModule } from './agents/agents.module';
import { PostAgentAdaptersModule } from './adapters/post-agent-adapters.module';
import { BuddyModule } from './buddy/buddy.module';
import { IntentRouterModule } from './intent/intent-router.module';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AiTurnPipeline } from './orchestration/ai-turn.pipeline';
import { AiSseBuilder } from './presentation/ai-sse.builder';
import { AiChatWsHandler } from './ws/ai-chat-ws.handler';
import { AiChatWsServer } from './ws/ai-chat-ws.server';

@Module({
  imports: [
    ActivityModule,
    ProfileModule,
    ChatModule,
    PostModule,
    ChromaModule,
    RagModule,
    HandlerModule,
    OrchestrationModule,
    ParserModule,
    AgentsModule,
    IntentRouterModule,
    BuddyModule,
  ],
  providers: [
    AiService,
    AiRateLimitService,
    AiTurnPipeline,
    AiSseBuilder,
    AiChatWsHandler,
    AiChatWsServer,
  ],
})
export class AiModule {}
