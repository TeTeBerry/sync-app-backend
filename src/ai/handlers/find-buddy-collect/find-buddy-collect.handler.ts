import { Injectable } from '@nestjs/common';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { FindBuddyCollectComposer } from './find-buddy-collect.composer';
import { FindBuddyCollectExecutor } from './find-buddy-collect.executor';
import { FindBuddyCollectMatcher } from './find-buddy-collect.matcher';
import { FindBuddyCollectPlanner } from './find-buddy-collect.planner';

@Injectable()
export class FindBuddyCollectHandler implements ReplyHandler {
  readonly id = 'find-buddy-collect';

  constructor(
    private readonly matcher: FindBuddyCollectMatcher,
    private readonly planner: FindBuddyCollectPlanner,
    private readonly executor: FindBuddyCollectExecutor,
    private readonly composer: FindBuddyCollectComposer,
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
