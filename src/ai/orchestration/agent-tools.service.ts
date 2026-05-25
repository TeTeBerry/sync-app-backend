import { Injectable } from '@nestjs/common';
import type { ReplyContext, AgentToolCall } from '../handlers';
import { TicketListingService } from '../ticket/ticket-listing.service';
import { buildTicketSearchResponse } from '../utils/ticket-search.handler';
import { TicketService } from '../../modules/ticket/ticket.service';
import { ActivityService } from '../../modules/activity/activity.service';
import { FindBuddyPindanCreateService } from '../pindan/find-buddy-pindan-create.service';

export interface AgentToolResult {
  tool: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

type ToolExecutor = (ctx: ReplyContext, args?: Record<string, unknown>) => Promise<Record<string, unknown> | void>;

@Injectable()
export class AgentToolsService {
  private readonly registry = new Map<string, ToolExecutor>();

  constructor(
    private readonly ticketListingService: TicketListingService,
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
    private readonly findBuddyPindanCreateService: FindBuddyPindanCreateService,
  ) {
    this.registry.set('ticket.collectSlots', async (_ctx, args) => ({
      stage: 'collect',
      mode: String(args?.mode ?? 'incremental'),
    }));

    this.registry.set('ticket.createListing', async (ctx) => {
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
    });

    this.registry.set('ticket.searchListings', async (ctx, args) => {
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
    });

    this.registry.set('findBuddy.collectCreateSlots', async (_ctx, args) => ({
      stage: 'collect_create_pindan',
      mode: String(args?.mode ?? 'incremental'),
    }));

    this.registry.set('findBuddy.createPindan', async (ctx) => {
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
    });

    this.registry.set('findBuddy.searchPindan', async (_ctx, args) => ({
      stage: 'search_pindan',
      query: String(args?.query ?? ''),
    }));
  }

  async executeAll(ctx: ReplyContext, calls: AgentToolCall[]): Promise<AgentToolResult[]> {
    const results: AgentToolResult[] = [];

    for (const call of calls) {
      const executor = this.registry.get(call.tool);
      if (!executor) {
        results.push({ tool: call.tool, ok: false, error: 'tool_not_found' });
        continue;
      }

      try {
        const data = await executor(ctx, call.args);
        results.push({
          tool: call.tool,
          ok: true,
          data: (data ?? {}) as Record<string, unknown>,
        });
      } catch (error) {
        results.push({
          tool: call.tool,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}
