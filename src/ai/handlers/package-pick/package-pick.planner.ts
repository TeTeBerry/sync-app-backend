import type { AgentToolCall, ReplyContext, ReplyPlanner } from '../../handler-pipeline/handler-pipeline.types';

export class PackagePickPlanner implements ReplyPlanner {
  plan(_ctx: ReplyContext): AgentToolCall[] {
    return [];
  }
}
