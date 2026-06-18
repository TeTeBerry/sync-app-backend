import { ActivityService } from '../../modules/activity/activity.service';
import { detectUserIntent } from '../intent/user-intent';
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
      (code) => activityService.findByCode(code),
    );
    if (festivalReply) return festivalReply;
  }

  switch (intent) {
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
