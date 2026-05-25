import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { PindanService } from '../../../modules/pindan/pindan.service';
import { ProfileService } from '../../../modules/profile/profile.service';
import { buildPindanJoinReply, type PindanJoinReplyResult } from '../../utils/pindan-join.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class PindanJoinExecutor implements ReplyExecutor<PindanJoinReplyResult> {
  constructor(
    private readonly pindanService: PindanService,
    private readonly activityService: ActivityService,
    private readonly profileService: ProfileService,
  ) {}

  async execute(ctx: ReplyContext): Promise<PindanJoinReplyResult | null> {
    return buildPindanJoinReply(
      ctx.messages,
      ctx.input,
      {
        pindanService: this.pindanService,
        activityService: this.activityService,
        profileService: this.profileService,
      },
      ctx,
      ctx.state,
    );
  }
}
