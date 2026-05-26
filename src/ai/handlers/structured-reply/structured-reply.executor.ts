import { Injectable } from '@nestjs/common';
import { buildStructuredReply, type StructuredReplyResult } from '../../utils/structured-reply.handler';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class StructuredReplyExecutor implements ReplyExecutor {
  async execute(ctx: ReplyContext): Promise<StructuredReplyResult | null> {
    return buildStructuredReply(ctx.messages, ctx.input, ctx.state);
  }
}
