import { ActivityService } from '../../../modules/activity/activity.service';
import type { FindBuddyPhase } from '../../conversation/conversation-state.types';
import {
  getMissingActivityCreateFields,
  mergeActivityCreateSlots,
} from '../../pindan/find-buddy-activity-create.util';
import {
  buildFindBuddyCollectCreateReply,
  buildFindBuddyCreatePindanPrompt,
} from '../../utils/find-buddy-reply.util';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

const COLLECT_CREATE_PINDAN_PHASE: FindBuddyPhase = 'collect_create_pindan';
const CONFIRM_CREATE_PINDAN_PHASE: FindBuddyPhase = 'confirm_create_pindan';

export class FindBuddyCollectExecutor implements ReplyExecutor {
  constructor(private readonly activityService: ActivityService) {}

  async execute(ctx: ReplyContext) {
    const fb = ctx.state.findBuddy;
    if (!fb) return null;

    const merged = mergeActivityCreateSlots(fb, ctx.input);
    const activityName =
      merged.activityKeyword ??
      (merged.activityId
        ? (await this.activityService.findByCode(merged.activityId))?.name
        : undefined) ??
      merged.activityId;

    const missing = getMissingActivityCreateFields(merged);

    if (missing.length > 0) {
      return {
        text: buildFindBuddyCollectCreateReply(merged, activityName),
        nextState: {
          ...ctx.state,
          findBuddy: {
            ...merged,
            phase: COLLECT_CREATE_PINDAN_PHASE,
          },
        },
      };
    }

    return {
      text: buildFindBuddyCreatePindanPrompt(merged, activityName),
      nextState: {
        ...ctx.state,
        findBuddy: {
          ...merged,
          phase: CONFIRM_CREATE_PINDAN_PHASE,
        },
      },
    };
  }
}
