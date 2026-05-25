import { Injectable } from '@nestjs/common';
import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';
import type { TicketSelectReplyResult } from '../../utils/ticket-select.handler';

@Injectable()
export class TicketSelectComposer implements ReplyComposer {
  compose(ctx: ReplyContext, result: TicketSelectReplyResult): DeterministicReplyResult {
    return {
      text: result.text,
      ticketCard: result.ticketCard,
      nextState: result.nextState ?? ctx.state,
    };
  }
}
