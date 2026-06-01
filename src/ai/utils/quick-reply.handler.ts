import { ActivityService } from '../../modules/activity/activity.service';
import { detectUserIntent } from '../intent/user-intent';
import {
  ACTIVITY_PICKER_PROMPT,
  buildScopedFindBuddyReply,
} from './activity-reply.util';
import { buildHomeFestivalShortcutReplyFromCatalog } from './festival-shortcut.util';
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

  if (activityLegacyId == null) {
    const festivalReply = await buildHomeFestivalShortcutReplyFromCatalog(
      input,
      (code) => activityService.findByCode(code).exec(),
    );
    if (festivalReply) return festivalReply;
  }

  switch (intent) {
    case 'find_buddy': {
      if (activityLegacyId != null) {
        const activity = await activityService.findByLegacyId(activityLegacyId);
        const activityName = activity?.name ?? '该活动';
        return buildScopedFindBuddyReply(activityName);
      }

      return composeReply([
        '好的，我来帮你找同行伙伴 🎵',
        '',
        ACTIVITY_PICKER_PROMPT,
        '直接回复活动名（如 EDC、Ultra），告诉我出行时间、人数和性别偏好即可。',
      ]);
    }

    case 'near_events': {
      return composeReply([
        '这些是平台近期热门活动 📅',
        '',
        '你对哪个活动感兴趣？直接回复活动名，我可以帮你查更多信息。',
      ]);
    }

    default:
      return null;
  }
}
