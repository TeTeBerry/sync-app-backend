import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { PindanService } from '../../../modules/pindan/pindan.service';
import { TicketService } from '../../../modules/ticket/ticket.service';
import { ProfileService } from '../../../modules/profile/profile.service';
import { buildStructuredReply, type StructuredReplyResult } from '../../utils/structured-reply.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class StructuredReplyExecutor implements ReplyExecutor {
  constructor(
    private readonly pindanService: PindanService,
    private readonly activityService: ActivityService,
    private readonly ticketService: TicketService,
    private readonly profileService: ProfileService,
  ) {}

  async execute(ctx: ReplyContext): Promise<StructuredReplyResult | null> {
    return buildStructuredReply(
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
  }
}
