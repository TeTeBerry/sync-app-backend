import { Injectable } from '@nestjs/common';
import type { ReplyContext } from '../handler-pipeline';
import type { AgentTool } from './agent-tool.types';
import { TicketListingService } from '../ticket/ticket-listing.service';
import { buildTicketSearchResponse } from '../utils/ticket-search.handler';
import { TicketService } from '../../modules/ticket/ticket.service';
import { ActivityService } from '../../modules/activity/activity.service';
import { FindBuddyPindanCreateService } from '../pindan/find-buddy-pindan-create.service';

@Injectable()
export class TicketCollectSlotsTool implements AgentTool {
  readonly name = 'ticket.collectSlots';
  async execute(_ctx: ReplyContext, args?: Record<string, unknown>) {
    return { stage: 'collect', mode: String(args?.mode ?? 'incremental') };
  }
}

@Injectable()
export class TicketCreateListingTool implements AgentTool {
  readonly name = 'ticket.createListing';
  constructor(private readonly ticketListingService: TicketListingService) {}
  async execute(ctx: ReplyContext) {
    const draft = ctx.state.ticketListing?.draft;
    if (!draft) return { created: false, reason: 'missing_ticket_draft' };
    const result = await this.ticketListingService.createFromDraft(draft, {
      userId: ctx.userId,
      userName: ctx.userName,
      userPhone: ctx.userPhone,
      onTicketCreated: ctx.onTicketCreated,
    });
    return {
      created: Boolean(result.ticketId),
      ticketId: result.ticketId,
      replyText: result.text,
    };
  }
}

@Injectable()
export class TicketSearchListingsTool implements AgentTool {
  readonly name = 'ticket.searchListings';
  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}
  async execute(ctx: ReplyContext, args?: Record<string, unknown>) {
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

@Injectable()
export class FindBuddyCollectCreateSlotsTool implements AgentTool {
  readonly name = 'findBuddy.collectCreateSlots';
  async execute(_ctx: ReplyContext, args?: Record<string, unknown>) {
    return { stage: 'collect_create_pindan', mode: String(args?.mode ?? 'incremental') };
  }
}

@Injectable()
export class FindBuddyCreatePindanTool implements AgentTool {
  readonly name = 'findBuddy.createPindan';
  constructor(
    private readonly findBuddyPindanCreateService: FindBuddyPindanCreateService,
  ) {}
  async execute(ctx: ReplyContext) {
    if (!ctx.state.findBuddy) return { created: false, reason: 'missing_find_buddy_state' };
    const result = await this.findBuddyPindanCreateService.createFromFindBuddy({
      state: ctx.state,
      userId: ctx.userId,
    });
    return {
      created: Boolean(result.pindanCard),
      pindanCard: result.pindanCard,
      nextState: result.nextState,
      replyText: result.text,
    };
  }
}

@Injectable()
export class FindBuddySearchPindanTool implements AgentTool {
  readonly name = 'findBuddy.searchPindan';
  async execute(_ctx: ReplyContext, args?: Record<string, unknown>) {
    return { stage: 'search_pindan', query: String(args?.query ?? '') };
  }
}

export const ALL_AGENT_TOOLS = [
  TicketCollectSlotsTool,
  TicketCreateListingTool,
  TicketSearchListingsTool,
  FindBuddyCollectCreateSlotsTool,
  FindBuddyCreatePindanTool,
  FindBuddySearchPindanTool,
] as const;
