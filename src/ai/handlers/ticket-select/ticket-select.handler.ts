import { Injectable } from '@nestjs/common';
import type {
  AgentStateProgression,
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { TicketSelectComposer } from './ticket-select.composer';
import { TicketSelectExecutor } from './ticket-select.executor';
import { TicketSelectMatcher } from './ticket-select.matcher';
import { TicketSelectPlanner } from './ticket-select.planner';

@Injectable()
export class TicketSelectHandler implements ReplyHandler {
  readonly id = 'ticket-select';

  constructor(
    private readonly matcher: TicketSelectMatcher,
    private readonly planner: TicketSelectPlanner,
    private readonly executor: TicketSelectExecutor,
    private readonly composer: TicketSelectComposer,
  ) {}

  getPlannedToolCalls(ctx: ReplyContext) {
    return this.planner.plan(ctx);
  }

  getStateProgression(_ctx: ReplyContext): AgentStateProgression {
    return {
      flow: 'ticket_search',
      phase: 'selected',
      summary: '从检索结果选择目标票务并生成卡片',
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
