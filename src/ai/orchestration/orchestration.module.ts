import { Module } from '@nestjs/common';
import { ConversationStateService } from './conversation-state.service';
import { TicketListingStateAdvancer } from './ticket-listing-state.advancer';
import { FindBuddyStateAdvancer } from './find-buddy-state.advancer';
import { ImageDisambiguationService } from './image-disambiguation.service';
import { DeterministicReplyService } from './deterministic-reply.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentToolsService, AGENT_TOOL_TOKEN } from './agent-tools.service';
import {
  TicketCollectSlotsTool,
  TicketCreateListingTool,
  TicketSearchListingsTool,
  FindBuddyCollectCreateSlotsTool,
  FindBuddyCreatePindanTool,
  FindBuddySearchPindanTool,
} from './agent-tools';
import { ReplyFallbackProvider } from './reply-fallback.provider';
import { RagModule } from '../rag/rag.module';
import { ParserModule } from '../parser/parser.module';
import { ActivityModule } from '../../modules/activity/activity.module';
import { TicketModule } from '../../modules/ticket/ticket.module';
import { PindanModule } from '../../modules/pindan/pindan.module';
import { ProfileModule } from '../../modules/profile/profile.module';
import { HandlerModule } from '../handlers/handler.module';

@Module({
  imports: [
    RagModule,
    ParserModule,
    ActivityModule,
    TicketModule,
    PindanModule,
    ProfileModule,
    HandlerModule,
  ],
  providers: [
    ConversationStateService,
    TicketListingStateAdvancer,
    FindBuddyStateAdvancer,
    ImageDisambiguationService,
    DeterministicReplyService,
    AgentRuntimeService,
    AgentToolsService,
    ReplyFallbackProvider,
    TicketCollectSlotsTool,
    TicketCreateListingTool,
    TicketSearchListingsTool,
    FindBuddyCollectCreateSlotsTool,
    FindBuddyCreatePindanTool,
    FindBuddySearchPindanTool,
    {
      provide: AGENT_TOOL_TOKEN,
      useFactory: (
        t1: TicketCollectSlotsTool,
        t2: TicketCreateListingTool,
        t3: TicketSearchListingsTool,
        t4: FindBuddyCollectCreateSlotsTool,
        t5: FindBuddyCreatePindanTool,
        t6: FindBuddySearchPindanTool,
      ) => [t1, t2, t3, t4, t5, t6],
      inject: [
        TicketCollectSlotsTool,
        TicketCreateListingTool,
        TicketSearchListingsTool,
        FindBuddyCollectCreateSlotsTool,
        FindBuddyCreatePindanTool,
        FindBuddySearchPindanTool,
      ],
    },
  ],
  exports: [
    ConversationStateService,
    AgentRuntimeService,
    AgentToolsService,
    DeterministicReplyService,
  ],
})
export class OrchestrationModule {}
