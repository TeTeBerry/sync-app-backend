import { ActivityService } from '../../modules/activity/activity.service';
import { detectUserIntent } from './user-intent';
import {
  formatActivityPickerLines,
  ACTIVITY_PICKER_PROMPT,
  buildScopedFindBuddyReply,
} from './activity-reply.util';
import { composeReply } from './reply-text.util';

export async function buildQuickReplyResponse(
  input: string,
  services: {
    activityService: ActivityService;
  },
  activityLegacyId?: number,
): Promise<string | null> {
  const intent = detectUserIntent(input);
  const { activityService } = services;

  switch (intent) {
    case 'find_buddy': {
      if (activityLegacyId != null) {
        const activity = await activityService.findByLegacyId(activityLegacyId);
        const activityName = activity?.name ?? '该活动';
        return buildScopedFindBuddyReply(activityName);
      }

      const activities = await activityService.findAll();
      return composeReply([
        '好的，我来帮你找同行伙伴 🎵',
        '',
        ACTIVITY_PICKER_PROMPT,
        formatActivityPickerLines(activities),
        '',
        '直接回复活动名（如 EDC、Ultra），告诉我日期、人数和出发城市即可。',
      ]);
    }

    case 'near_events': {
      const activities = await activityService.findAll();
      return composeReply([
        '这些是平台近期热门活动 📅',
        '',
        formatActivityPickerLines(activities),
        '',
        '你对哪个活动感兴趣？告诉我活动名，我可以帮你查更多信息。',
      ]);
    }

    default:
      return null;
  }
}
