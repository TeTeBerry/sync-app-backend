import { Injectable } from '@nestjs/common';
import { isFindBuddyFlow } from '../../conversation';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class PindanCreateMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    const fb = ctx.state.findBuddy;
    if (!isFindBuddyFlow(ctx.state) || !fb) return false;
    return fb.phase === 'confirm_create_pindan';
  }
}
