import { Injectable } from '@nestjs/common';
import { setTicketSearchJoinableIds } from '../../conversation';
import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';
import type { TicketSearchReplyResult } from '../../utils/ticket-search.handler';

@Injectable()
export class TicketSearchComposer implements ReplyComposer<TicketSearchReplyResult> {
  compose(ctx: ReplyContext, result: TicketSearchReplyResult): DeterministicReplyResult {
    return {
      text: result.text,
      nextState: setTicketSearchJoinableIds(
        ctx.state,
        result.joinableTicketIds,
        {
          activityId: result.activityId,
          activityKeyword: result.activityKeyword,
          type: result.type,
        },
      ),
    };
  }
}
