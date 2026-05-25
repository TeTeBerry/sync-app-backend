import type { AgentToolCall, ReplyContext, ReplyPlanner } from '../../handler-pipeline/handler-pipeline.types';

export class FindBuddyCollectPlanner implements ReplyPlanner {
  plan(_ctx: ReplyContext): AgentToolCall[] {
    return [{ tool: 'findBuddy.collectCreateSlots', args: { mode: 'incremental' } }];
  }
}
