import { Injectable } from '@nestjs/common';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { QuickReplyComposer } from './quick-reply.composer';
import { QuickReplyExecutor } from './quick-reply.executor';
import { QuickReplyMatcher } from './quick-reply.matcher';
import { QuickReplyPlanner } from './quick-reply.planner';

@Injectable()
export class QuickReplyHandler implements ReplyHandler {
  readonly id = 'quick-reply';

  constructor(
    private readonly matcher: QuickReplyMatcher,
    private readonly planner: QuickReplyPlanner,
    private readonly executor: QuickReplyExecutor,
    private readonly composer: QuickReplyComposer,
  ) {}

  getPlannedToolCalls(ctx: ReplyContext) {
    return this.planner.plan(ctx);
  }

  canHandle(ctx: ReplyContext): boolean {
    return this.matcher.matches(ctx);
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const result = await this.executor.execute(ctx);
    if (!result) return null;
    return this.composer.compose(ctx, result);
  }
}
