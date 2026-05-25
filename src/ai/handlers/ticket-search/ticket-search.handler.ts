import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import { TicketService } from '../../../modules/ticket/ticket.service';
import type {
  AgentStateProgression,
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from '../../handler-pipeline/reply-handler.types';
import { TicketSearchComposer } from './ticket-search.composer';
import { TicketSearchExecutor } from './ticket-search.executor';
import { TicketSearchMatcher } from './ticket-search.matcher';
import { TicketSearchPlanner } from './ticket-search.planner';

@Injectable()
export class TicketSearchHandler implements ReplyHandler {
  readonly id = 'ticket-search';

  constructor(
    private readonly matcher: TicketSearchMatcher,
    private readonly planner: TicketSearchPlanner,
    private readonly executor: TicketSearchExecutor,
    private readonly composer: TicketSearchComposer,
  ) {}

  getPlannedToolCalls(ctx: ReplyContext) {
    return this.planner.plan(ctx);
  }

  getStateProgression(_ctx: ReplyContext): AgentStateProgression {
    return {
      flow: 'ticket_search',
      phase: 'query',
      summary: '按活动与票务类型检索挂单',
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
