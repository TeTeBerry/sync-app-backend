import { Injectable } from '@nestjs/common';
import { buildTicketSearchResponse } from '../utils/ticket-search.handler';
import { isTicketSearchQuery } from '../utils/ticket-search.util';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class TicketSearchHandler implements ReplyHandler {
  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    return isTicketSearchQuery(ctx.input);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const text = await buildTicketSearchResponse(ctx.input, {
      ticketService: this.ticketService,
      activityService: this.activityService,
    });
    if (!text) return null;

    return { text, nextState: ctx.state };
  }
}
