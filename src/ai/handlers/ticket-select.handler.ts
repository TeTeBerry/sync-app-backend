import { Injectable } from '@nestjs/common';
import {
  buildTicketSelectReply,
  shouldHandleTicketSelect,
} from '../utils/ticket-select.handler';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class TicketSelectHandler implements ReplyHandler {
  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    return shouldHandleTicketSelect(ctx.state, ctx.input);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await buildTicketSelectReply(ctx.input, {
      ticketService: this.ticketService,
      activityService: this.activityService,
    }, ctx.state);
    if (!result) return null;

    return {
      text: result.text,
      ticketCard: result.ticketCard,
      nextState: result.nextState ?? ctx.state,
    };
  }
}
