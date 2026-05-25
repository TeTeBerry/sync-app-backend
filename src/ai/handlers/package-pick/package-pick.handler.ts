import { Injectable } from '@nestjs/common';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { PackagePickComposer } from './package-pick.composer';
import { PackagePickExecutor } from './package-pick.executor';
import { PackagePickMatcher } from './package-pick.matcher';
import { PackagePickPlanner } from './package-pick.planner';

@Injectable()
export class PackagePickHandler implements ReplyHandler {
  readonly id = 'package-pick';

  constructor(
    private readonly matcher: PackagePickMatcher,
    private readonly planner: PackagePickPlanner,
    private readonly executor: PackagePickExecutor,
    private readonly composer: PackagePickComposer,
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
