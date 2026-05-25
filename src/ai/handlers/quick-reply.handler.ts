import { Injectable } from '@nestjs/common';
import { applyFlowSwitch } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import { buildQuickReplyResponse } from '../utils/quick-reply.handler';
import { isQuickReplyIntent } from '../utils/user-intent';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class QuickReplyHandler implements ReplyHandler {
  constructor(
    private readonly activityService: ActivityService,
    private readonly pindanService: PindanService,
    private readonly profileService: ProfileService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    return isQuickReplyIntent(ctx.input);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
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

    const nextState =
      applyFlowSwitch({ version: 1, flow: 'idle' }, ctx.input) ?? ctx.state;
    return { text, nextState };
  }
}
