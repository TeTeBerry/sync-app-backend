import { Injectable } from '@nestjs/common';
import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class PindanCreateComposer implements ReplyComposer {
  compose(_ctx: ReplyContext, result: DeterministicReplyResult): DeterministicReplyResult {
    return result;
  }
}
