import { Injectable } from '@nestjs/common';
import { isTicketListingFlow } from '../conversation';
import { isTicketSearchQuery } from '../utils/ticket-search.util';
import { isExactQuickReply } from '../utils/user-intent';
import { TicketListingService } from '../ticket/ticket-listing.service';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class TicketListingHandler implements ReplyHandler {
  constructor(private readonly ticketListingService: TicketListingService) {}

  canHandle(ctx: ReplyContext): boolean {
    if (!isTicketListingFlow(ctx.state)) return false;
    if (isExactQuickReply(ctx.input) && !ctx.image?.trim()) return false;
    if (isTicketSearchQuery(ctx.input)) return false;
    return true;
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await this.ticketListingService.processListingFlow(ctx);
    return {
      text: result.text,
      ticketId: result.ticketId,
      nextState: result.nextState,
    };
  }
}
