import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmService } from './llm/llm.service';
import { ActivityModule } from '../modules/activity/activity.module';
import { TicketModule } from '../modules/ticket/ticket.module';
import { PindanModule } from '../modules/pindan/pindan.module';
import { ProfileModule } from '../modules/profile/profile.module';
import { ChatModule } from '../modules/chat/chat.module';
import { ConversationStateService } from './orchestration/conversation-state.service';
import { DeterministicReplyService } from './orchestration/deterministic-reply.service';
import { LlmSlotParserService } from './parser/llm-slot-parser.service';
import { TicketListingService } from './ticket/ticket-listing.service';
import { QuickReplyHandler } from './handlers/quick-reply.handler';
import { PindanJoinHandler } from './handlers/pindan-join.handler';
import { TicketListingHandler } from './handlers/ticket-listing.handler';
import { StructuredReplyHandler } from './handlers/structured-reply.handler';
import { TicketSearchHandler } from './handlers/ticket-search.handler';

@Module({
  imports: [ActivityModule, TicketModule, PindanModule, ProfileModule, ChatModule],
  controllers: [AiController],
  providers: [
    AiService,
    LlmService,
    LlmSlotParserService,
    ConversationStateService,
    DeterministicReplyService,
    TicketListingService,
    QuickReplyHandler,
    PindanJoinHandler,
    TicketListingHandler,
    StructuredReplyHandler,
    TicketSearchHandler,
  ],
})
export class AiModule {}
