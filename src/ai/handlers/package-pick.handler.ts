import { Injectable } from '@nestjs/common';
import { isFindBuddyFlow } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  applySelectedPackage,
  buildFindBuddyPickPackageReply,
  parsePackageSelection,
} from '../utils/find-buddy-package.util';
import { reconcileFindBuddyActivity } from '../parser/find-buddy-merge.util';
import { buildFindBuddyCreatePindanPrompt } from '../utils/find-buddy-reply.util';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class PackagePickHandler implements ReplyHandler {
  constructor(private readonly activityService: ActivityService) {}
  canHandle(ctx: ReplyContext): boolean {
    const fb = ctx.state.findBuddy;
    return (
      isFindBuddyFlow(ctx.state) &&
      fb?.phase === 'pick_package' &&
      (fb.packageOptions?.length ?? 0) >= 2
    );
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
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
          phase: 'confirm_create_pindan',
        },
      },
    };
  }
}
