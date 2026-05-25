import { isFindBuddyFlow } from '../../conversation';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

export class FindBuddyCollectMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    const fb = ctx.state.findBuddy;
    return Boolean(isFindBuddyFlow(ctx.state) && fb?.phase === 'collect_create_pindan');
  }
}
