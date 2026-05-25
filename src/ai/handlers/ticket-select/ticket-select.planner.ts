import { Injectable } from '@nestjs/common';
import type { AgentToolCall, ReplyContext, ReplyPlanner } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class TicketSelectPlanner implements ReplyPlanner {
  plan(ctx: ReplyContext): AgentToolCall[] {
    return [{ tool: 'ticket.searchListings', args: { query: ctx.input, mode: 'select' } }];
  }
}
