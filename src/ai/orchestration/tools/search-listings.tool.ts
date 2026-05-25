import { Injectable } from '@nestjs/common';
import type { ReplyContext } from '../../handler-pipeline';
import type { AgentTool } from '../agent-tool.types';
import { buildTicketSearchResponse } from '../../utils/ticket-search.handler';
import { TicketService } from '../../../modules/ticket/ticket.service';
import { ActivityService } from '../../../modules/activity/activity.service';

@Injectable()
export class SearchListingsTool implements AgentTool {
  readonly name = 'ticket.searchListings';

  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  async execute(ctx: ReplyContext, args?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const query = String(args?.query ?? ctx.input ?? '');
    const result = await buildTicketSearchResponse(query, {
      ticketService: this.ticketService,
      activityService: this.activityService,
    });

    if (!result) return { found: false };

    return {
      found: true,
      joinableTicketIds: result.joinableTicketIds,
      activityId: result.activityId,
      activityKeyword: result.activityKeyword,
      type: result.type,
    };
  }
}
