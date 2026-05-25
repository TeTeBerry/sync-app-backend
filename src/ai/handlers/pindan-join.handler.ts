import { Injectable } from '@nestjs/common';
import {
  buildPindanJoinReply,
  shouldHandlePindanJoin,
} from '../utils/pindan-join.handler';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class PindanJoinHandler implements ReplyHandler {
  constructor(
    private readonly pindanService: PindanService,
    private readonly activityService: ActivityService,
    private readonly profileService: ProfileService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    return shouldHandlePindanJoin(ctx.state, ctx.input, ctx.messages);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await buildPindanJoinReply(
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
    if (!result) return null;

    return {
      text: result.text,
      pindanCard: result.pindanCard,
      nextState: result.nextState ?? ctx.state,
    };
  }
}
