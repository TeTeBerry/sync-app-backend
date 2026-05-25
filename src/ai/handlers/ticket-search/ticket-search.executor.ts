import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { TicketService } from '../../../modules/ticket/ticket.service';
import { buildTicketSearchResponse, type TicketSearchReplyResult } from '../../utils/ticket-search.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class TicketSearchExecutor implements ReplyExecutor<TicketSearchReplyResult> {
  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  async execute(ctx: ReplyContext): Promise<TicketSearchReplyResult | null> {
    return buildTicketSearchResponse(ctx.input, {
      ticketService: this.ticketService,
      activityService: this.activityService,
    });
  }
}
