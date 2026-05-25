import { Injectable } from '@nestjs/common';
import type { AgentToolCall, ReplyContext, ReplyPlanner } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class StructuredReplyPlanner implements ReplyPlanner {
  plan(_ctx: ReplyContext): AgentToolCall[] {
    return [];
  }
}
