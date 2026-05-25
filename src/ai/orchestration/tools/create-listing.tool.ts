import { Injectable } from '@nestjs/common';
import type { ReplyContext } from '../../handler-pipeline';
import type { AgentTool } from '../agent-tool.types';
import { TicketListingService } from '../../ticket/ticket-listing.service';

@Injectable()
export class CreateListingTool implements AgentTool {
  readonly name = 'ticket.createListing';

  constructor(private readonly ticketListingService: TicketListingService) {}

  async execute(ctx: ReplyContext): Promise<Record<string, unknown>> {
    const draft = ctx.state.ticketListing?.draft;
    if (!draft) return { created: false, reason: 'missing_ticket_draft' };

    const result = await this.ticketListingService.createFromDraft(draft, {
      userId: ctx.userId,
      userName: ctx.userName,
      userPhone: ctx.userPhone,
      onTicketCreated: ctx.onTicketCreated,
    });

    return {
      created: Boolean(result.ticketId),
      ticketId: result.ticketId,
      replyText: result.text,
    };
  }
}
