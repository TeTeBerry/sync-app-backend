import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { TicketService } from '../../../modules/ticket/ticket.service';
import { buildTicketSelectReply, type TicketSelectReplyResult } from '../../utils/ticket-select.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class TicketSelectExecutor implements ReplyExecutor<TicketSelectReplyResult> {
  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  async execute(ctx: ReplyContext): Promise<TicketSelectReplyResult | null> {
    return buildTicketSelectReply(
      ctx.input,
      {
        ticketService: this.ticketService,
        activityService: this.activityService,
      },
      ctx.state,
    );
  }
}
