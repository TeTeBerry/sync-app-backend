import { Injectable } from '@nestjs/common';
import {
  buildStructuredReply,
  shouldHandleStructuredReply,
} from '../utils/structured-reply.handler';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class StructuredReplyHandler implements ReplyHandler {
  constructor(
    private readonly pindanService: PindanService,
    private readonly activityService: ActivityService,
    private readonly ticketService: TicketService,
    private readonly profileService: ProfileService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    return shouldHandleStructuredReply(ctx.state, ctx.messages, ctx.input);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await buildStructuredReply(
      ctx.messages,
      ctx.input,
      {
        pindanService: this.pindanService,
        activityService: this.activityService,
        ticketService: this.ticketService,
        profileService: this.profileService,
      },
      ctx,
      ctx.state,
    );
    if (!result) return null;

    return {
      text: result.text,
      pindanCard: result.pindanCard,
      nextState: result.nextState,
    };
  }
}
