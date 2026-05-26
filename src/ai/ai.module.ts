import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
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
import { PostIntentService } from './post-intent.service';
import { IntentRouterModule } from './intent/intent-router.module';

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
  ],
  controllers: [AiController],
  providers: [AiService, PostIntentService],
})
export class AiModule {}
