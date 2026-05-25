import { ActivityService } from '../../../modules/activity/activity.service';
import type { FindBuddyPhase } from '../../conversation/conversation-state.types';
import {
  applySelectedPackage,
  buildFindBuddyPickPackageReply,
  parsePackageSelection,
} from '../../utils/find-buddy-package.util';
import { reconcileFindBuddyActivity } from '../../parser/find-buddy-merge.util';
import { buildFindBuddyCreatePindanPrompt } from '../../utils/find-buddy-reply.util';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

const CONFIRM_CREATE_PINDAN_PHASE: FindBuddyPhase = 'confirm_create_pindan';

export class PackagePickExecutor implements ReplyExecutor {
  constructor(private readonly activityService: ActivityService) {}

  async execute(ctx: ReplyContext) {
    const fb = ctx.state.findBuddy;
    if (!fb) return null;
    const options = fb.packageOptions;
    if (!options || options.length < 2) return null;

    const selectedIndex = parsePackageSelection(ctx.input, options);
    if (selectedIndex == null) {
      return {
        text: buildFindBuddyPickPackageReply(fb),
        nextState: ctx.state,
      };
    }

    const updatedFb = reconcileFindBuddyActivity(
      applySelectedPackage(fb, options[selectedIndex], selectedIndex),
    );
    const matchedActivity = updatedFb.activityId
      ? await this.activityService.findByCode(updatedFb.activityId)
      : updatedFb.activityKeyword
        ? await this.activityService.matchActivity(updatedFb.activityKeyword)
        : null;
    const activityName =
      matchedActivity?.name ??
      updatedFb.activityKeyword ??
      updatedFb.packageName ??
      '该活动';

    return {
      text: buildFindBuddyCreatePindanPrompt(updatedFb, activityName),
      nextState: {
        ...ctx.state,
        findBuddy: {
          ...updatedFb,
          packageOptions: undefined,
          phase: CONFIRM_CREATE_PINDAN_PHASE,
        },
      },
    };
  }
}
