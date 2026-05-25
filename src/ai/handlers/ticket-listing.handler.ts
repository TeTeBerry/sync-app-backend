import { Injectable } from '@nestjs/common';
import { isTicketListingFlow } from '../conversation';
import { isTicketSearchQuery } from '../utils/ticket-search.util';
import { TicketListingService } from '../ticket/ticket-listing.service';
import type {
  AgentStateProgression,
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class TicketListingHandler implements ReplyHandler {
  constructor(private readonly ticketListingService: TicketListingService) {}

  getPlannedToolCalls(ctx: ReplyContext) {
    const phase = ctx.state.ticketListing?.phase;
    if (phase === 'confirm') {
      return [{ tool: 'ticket.createListing', args: { mode: 'confirm_if_user_agreed' } }];
    }
    return [{ tool: 'ticket.collectSlots', args: { mode: 'incremental' } }];
  }

  getStateProgression(ctx: ReplyContext): AgentStateProgression {
    const phase = ctx.state.ticketListing?.phase ?? 'collect';
    return {
      flow: 'ticket_listing',
      phase,
      summary: phase === 'confirm' ? '待用户确认后发布票务' : '持续收集票务槽位',
    };
  }

  canHandle(ctx: ReplyContext): boolean {
    if (!isTicketListingFlow(ctx.state)) return false;
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
