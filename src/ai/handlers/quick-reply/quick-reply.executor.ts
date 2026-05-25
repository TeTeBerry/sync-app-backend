import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { PindanService } from '../../../modules/pindan/pindan.service';
import { ProfileService } from '../../../modules/profile/profile.service';
import { buildQuickReplyResponse } from '../../utils/quick-reply.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class QuickReplyExecutor implements ReplyExecutor {
  constructor(
    private readonly activityService: ActivityService,
    private readonly pindanService: PindanService,
    private readonly profileService: ProfileService,
  ) {}

  async execute(ctx: ReplyContext) {
    const text = await buildQuickReplyResponse(
      ctx.input,
      {
        pindanService: this.pindanService,
        activityService: this.activityService,
        profileService: this.profileService,
      },
      ctx,
    );
    if (!text) return null;

    return { text, nextState: ctx.state };
  }
}
