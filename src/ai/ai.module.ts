import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ActivityModule } from '../modules/activity/activity.module';
import { TicketModule } from '../modules/ticket/ticket.module';
import { PindanModule } from '../modules/pindan/pindan.module';
import { ProfileModule } from '../modules/profile/profile.module';
import { ChatModule } from '../modules/chat/chat.module';
import { RagModule } from './rag/rag.module';
import { HandlerModule } from './handlers/handler.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { ParserModule } from './parser/parser.module';

@Module({
  imports: [
    ActivityModule,
    TicketModule,
    PindanModule,
    ProfileModule,
    ChatModule,
    RagModule,
    HandlerModule,
    OrchestrationModule,
    ParserModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
