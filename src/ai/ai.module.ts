import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentService } from './agent/agent.service';
import { LlmService } from './llm/llm.service';
import { MemoryService } from './context/memory.service';
import { ChromaService } from './rag/chroma.service';
import { RagService } from './rag/rag.service';
import { ActivityModule } from '../modules/activity/activity.module';
import { TicketModule } from '../modules/ticket/ticket.module';
import { PindanModule } from '../modules/pindan/pindan.module';
import { ChatModule } from '../modules/chat/chat.module';

@Module({
  imports: [ActivityModule, TicketModule, PindanModule, ChatModule],
  controllers: [AiController],
  providers: [
    AiService,
    AgentService,
    LlmService,
    MemoryService,
    ChromaService,
    RagService,
  ],
})
export class AiModule {}
