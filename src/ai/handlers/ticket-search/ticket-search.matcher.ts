import { Injectable } from '@nestjs/common';
import { isTicketSearchQuery } from '../../utils/ticket-search.util';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class TicketSearchMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    return isTicketSearchQuery(ctx.input);
  }
}
