import { ActivityService } from '../../modules/activity/activity.service';
import { detectUserIntent } from '../intent/user-intent';
import { ACTIVITY_PICKER_PROMPT } from './activity-reply.util';
import { buildHomeFestivalShortcutReplyFromCatalog } from './festival-shortcut.util';
import { isTravelGuideIntent } from './activity-guide.util';
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

  if (isTravelGuideIntent(input) && activityLegacyId != null) {
    const activity = await activityService.findByLegacyId(activityLegacyId);
    return composeReply([
      '🗺️ 好的，我来帮你规划出行攻略。',
      '',
      '直接说出出发地、人数、预算（经济/舒适/豪华）和是否自驾即可，例如：上海2人舒适自驾住2晚。',
      '也可点下方「AI出行攻略」用表单填写。',
      activity?.name ? `当前活动：${activity.name.trim()}` : '',
    ]);
  }

  if (activityLegacyId == null) {
    const festivalReply = await buildHomeFestivalShortcutReplyFromCatalog(
      input,
      (code) => activityService.findByCode(code).exec(),
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
