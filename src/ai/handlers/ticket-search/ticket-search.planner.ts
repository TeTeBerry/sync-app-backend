import { Injectable } from '@nestjs/common';
import type { ReplyContext, ReplyPlanner, AgentToolCall } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class TicketSearchPlanner implements ReplyPlanner {
  plan(ctx: ReplyContext): AgentToolCall[] {
    return [{ tool: 'ticket.searchListings', args: { query: ctx.input } }];
  }
}
