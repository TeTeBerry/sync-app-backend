import { Injectable } from '@nestjs/common';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { PindanJoinComposer } from './pindan-join.composer';
import { PindanJoinExecutor } from './pindan-join.executor';
import { PindanJoinMatcher } from './pindan-join.matcher';
import { PindanJoinPlanner } from './pindan-join.planner';

@Injectable()
export class PindanJoinHandler implements ReplyHandler {
  readonly id = 'pindan-join';

  constructor(
    private readonly matcher: PindanJoinMatcher,
    private readonly planner: PindanJoinPlanner,
    private readonly executor: PindanJoinExecutor,
    private readonly composer: PindanJoinComposer,
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
