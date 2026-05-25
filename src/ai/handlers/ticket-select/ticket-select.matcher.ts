import { Injectable } from '@nestjs/common';
import { isTicketSearchFlow } from '../../conversation';
import { isListSelectionInput } from '../../utils/list-selection.util';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

const MAX_SELECTION = 8;

@Injectable()
export class TicketSelectMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    if (!isTicketSearchFlow(ctx.state)) return false;
    if (ctx.state.ticketSearch?.phase !== 'browse') return false;
    if (!isListSelectionInput(ctx.input, MAX_SELECTION)) return false;
    return (ctx.state.ticketSearch.joinableTicketIds.length ?? 0) > 0;
  }
}
