import { Injectable } from '@nestjs/common';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import type { ConversationFlow } from '../../conversation';
import { PindanCreateComposer } from './pindan-create.composer';
import { PindanCreateExecutor } from './pindan-create.executor';
import { PindanCreateMatcher } from './pindan-create.matcher';
import { PindanCreatePlanner } from './pindan-create.planner';

@Injectable()
export class PindanCreateHandler implements ReplyHandler {
  readonly id = 'pindan-create';

  constructor(
    private readonly matcher: PindanCreateMatcher,
    private readonly planner: PindanCreatePlanner,
    private readonly executor: PindanCreateExecutor,
    private readonly composer: PindanCreateComposer,
  ) {}

  getPlannedToolCalls(ctx: ReplyContext) {
    return this.planner.plan(ctx);
  }

  getStateProgression(ctx: ReplyContext) {
    return {
      flow: 'find_buddy' as ConversationFlow,
      phase: ctx.state.findBuddy?.phase,
      summary: '结伴拼单创建确认与提交',
    };
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
