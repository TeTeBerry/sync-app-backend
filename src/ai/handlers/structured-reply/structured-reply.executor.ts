import { Injectable } from '@nestjs/common';
import {
  buildStructuredReply,
  type StructuredReplyResult,
} from '../../utils/structured-reply.handler';
import { ActivityService } from '../../../modules/activity/activity.service';
import type {
  ReplyContext,
  ReplyExecutor,
} from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class StructuredReplyExecutor implements ReplyExecutor {
  constructor(private readonly activityService: ActivityService) {}

  async execute(ctx: ReplyContext): Promise<StructuredReplyResult | null> {
    let activityName: string | undefined;
    if (ctx.activityLegacyId != null) {
      const activity = await this.activityService.findByLegacyId(
        ctx.activityLegacyId,
      );
      activityName = activity?.name;
    }

    return buildStructuredReply(
      ctx.messages,
      ctx.input,
      ctx.state,
      ctx.activityLegacyId,
      activityName,
    );
  }
}
