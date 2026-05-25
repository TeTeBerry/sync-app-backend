import { Injectable } from '@nestjs/common';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';
import { shouldHandleStructuredReply } from '../../utils/structured-reply.handler';

@Injectable()
export class StructuredReplyMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    return shouldHandleStructuredReply(ctx.state, ctx.messages, ctx.input);
  }
}
