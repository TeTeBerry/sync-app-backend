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
import { FindBuddyImageParserService } from './parser/find-buddy-image-parser.service';
import { LlmSlotParserService } from './parser/llm-slot-parser.service';
import { TicketImageParserService } from './parser/ticket-image-parser.service';
import { TicketListingService } from './ticket/ticket-listing.service';
import { RagModule } from './rag/rag.module';
import { FindBuddyPindanCreateService } from './pindan/find-buddy-pindan-create.service';
import {
  FindBuddyCollectHandler,
  PackagePickHandler,
  PindanCreateHandler,
  PindanJoinHandler,
  QuickReplyHandler,
  StructuredReplyHandler,
  TicketListingHandler,
  TicketSearchHandler,
  TicketSelectHandler,
} from './handlers';

@Module({
  imports: [
    ActivityModule,
    TicketModule,
    PindanModule,
    ProfileModule,
    ChatModule,
    RagModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    LlmService,
    LlmSlotParserService,
    FindBuddyImageParserService,
    TicketImageParserService,
    ConversationStateService,
    DeterministicReplyService,
    TicketListingService,
    FindBuddyPindanCreateService,
    QuickReplyHandler,
    PindanJoinHandler,
    FindBuddyCollectHandler,
    PackagePickHandler,
    PindanCreateHandler,
    TicketListingHandler,
    StructuredReplyHandler,
    TicketSearchHandler,
    TicketSelectHandler,
  ],
})
export class AiModule {}
