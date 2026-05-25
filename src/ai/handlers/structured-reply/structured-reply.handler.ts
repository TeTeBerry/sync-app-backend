import { Injectable } from '@nestjs/common';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { StructuredReplyComposer } from './structured-reply.composer';
import { StructuredReplyExecutor } from './structured-reply.executor';
import { StructuredReplyMatcher } from './structured-reply.matcher';
import { StructuredReplyPlanner } from './structured-reply.planner';

@Injectable()
export class StructuredReplyHandler implements ReplyHandler {
  readonly id = 'structured-reply';

  constructor(
    private readonly matcher: StructuredReplyMatcher,
    private readonly planner: StructuredReplyPlanner,
    private readonly executor: StructuredReplyExecutor,
    private readonly composer: StructuredReplyComposer,
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
