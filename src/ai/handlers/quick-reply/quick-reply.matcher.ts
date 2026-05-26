import { Injectable } from '@nestjs/common';
import { isQuickReplyIntent } from '../../utils/user-intent';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class QuickReplyMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    if (ctx.image?.trim()) return false;
    return isQuickReplyIntent(ctx.input);
  }
}
