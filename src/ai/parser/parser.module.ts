import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { LlmService } from '../llm/llm.service';
import { FindBuddyImageParserService } from './find-buddy-image-parser.service';
import { TicketImageParserService } from './ticket-image-parser.service';
import { LlmSlotParserService } from './llm-slot-parser.service';

@Module({
  imports: [ActivityModule],
  providers: [
    LlmService,
    FindBuddyImageParserService,
    TicketImageParserService,
    LlmSlotParserService,
  ],
  exports: [
    LlmService,
    FindBuddyImageParserService,
    TicketImageParserService,
    LlmSlotParserService,
  ],
})
export class ParserModule {}
