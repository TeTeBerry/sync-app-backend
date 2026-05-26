import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { buildQuickReplyResponse } from '../../utils/quick-reply.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class QuickReplyExecutor implements ReplyExecutor {
  constructor(private readonly activityService: ActivityService) {}

  async execute(ctx: ReplyContext) {
    const text = await buildQuickReplyResponse(
      ctx.input,
      {
        activityService: this.activityService,
      },
      ctx.activityLegacyId,
    );
    if (!text) return null;

    return { text, nextState: ctx.state };
  }
}
