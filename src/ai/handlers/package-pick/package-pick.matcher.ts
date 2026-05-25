import { isFindBuddyFlow } from '../../conversation';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

export class PackagePickMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    const fb = ctx.state.findBuddy;
    return (
      isFindBuddyFlow(ctx.state) &&
      fb?.phase === 'pick_package' &&
      (fb.packageOptions?.length ?? 0) >= 2
    );
  }
}
