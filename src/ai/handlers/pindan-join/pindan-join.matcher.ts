import { Injectable } from '@nestjs/common';
import { shouldHandlePindanJoin } from '../../utils/pindan-join.handler';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class PindanJoinMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    return shouldHandlePindanJoin(ctx.state, ctx.input, ctx.messages);
  }
}
