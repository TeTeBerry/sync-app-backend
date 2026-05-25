import { Injectable } from '@nestjs/common';
import { buildTicketSearchResponse } from '../utils/ticket-search.handler';
import { isTicketSearchQuery } from '../utils/ticket-search.util';
import { setTicketSearchJoinableIds } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import type {
  AgentStateProgression,
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class TicketSearchHandler implements ReplyHandler {
  getPlannedToolCalls(ctx: ReplyContext) {
    return [{ tool: 'ticket.searchListings', args: { query: ctx.input } }];
  }

  getStateProgression(_ctx: ReplyContext): AgentStateProgression {
    return {
      flow: 'ticket_search',
      phase: 'query',
      summary: '按活动与票务类型检索挂单',
    };
  }

  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    return isTicketSearchQuery(ctx.input);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await buildTicketSearchResponse(ctx.input, {
      ticketService: this.ticketService,
      activityService: this.activityService,
    });
    if (!result) return null;

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
