import { Injectable } from '@nestjs/common';
import type { AgentToolCall, ReplyContext, ReplyPlanner } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class PindanCreatePlanner implements ReplyPlanner {
  plan(ctx: ReplyContext): AgentToolCall[] {
    const fb = ctx.state.findBuddy;
    if (!fb) return [];
    if (fb.phase === 'confirm_create_pindan') {
      return [{ tool: 'findBuddy.createPindan', args: { phase: fb.phase } }];
    }
    return [{ tool: 'findBuddy.collectCreateSlots', args: { phase: fb.phase } }];
  }
}
