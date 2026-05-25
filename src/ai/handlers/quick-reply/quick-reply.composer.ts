import { Injectable } from '@nestjs/common';
import { applyFlowSwitch } from '../../conversation';
import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class QuickReplyComposer implements ReplyComposer {
  compose(ctx: ReplyContext, result: DeterministicReplyResult): DeterministicReplyResult {
    return {
      ...result,
      nextState: applyFlowSwitch(ctx.state, ctx.input) ?? ctx.state,
    };
  }
}
