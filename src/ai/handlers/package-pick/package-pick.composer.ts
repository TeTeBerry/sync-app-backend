import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';

export class PackagePickComposer implements ReplyComposer {
  compose(_ctx: ReplyContext, result: DeterministicReplyResult): DeterministicReplyResult {
    return result;
  }
}
