import { ActivityService } from '../../modules/activity/activity.service';
import { detectUserIntent } from '../intent/user-intent';
import { buildHomeFestivalShortcutReplyFromCatalog } from './festival-shortcut.util';
import { isTravelGuideIntent } from './activity-guide.util';
import { isActivityBriefIntent } from './activity-brief-intent.util';
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
  const trimmed = input.trim();

  if (isTravelGuideIntent(trimmed)) {
    if (activityLegacyId != null) {
      const activity = await activityService.findByLegacyId(activityLegacyId);
      return composeReply([
        '🗺️ 好的，我来帮你规划出行攻略。',
        '',
        '直接说出出发地、人数、预算（经济/舒适/豪华）和是否自驾即可，例如：上海2人舒适自驾住2晚。',
        '也可点下方「AI出行攻略」用表单填写。',
        activity?.name ? `当前活动：${activity.name.trim()}` : '',
      ]);
    }

    return composeReply([
      '🗺️ 出行攻略需要绑定具体活动。',
      '',
      '请先点下方电音节快捷按钮，或直接回复活动名；绑定后可以说「帮我规划行程」或点「AI出行攻略」。',
    ]);
  }

  if (activityLegacyId != null && isActivityBriefIntent(trimmed)) {
    const activity = await activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      return composeReply(['未找到当前活动信息，请稍后重试。']);
    }

    const lines = [
      `🎧 ${activity.name?.trim() || '本场活动'}`,
      activity.date?.trim() ? `📅 档期：${activity.date.trim()}` : '',
      activity.location?.trim() ? `📍 地点：${activity.location.trim()}` : '',
      '',
      '需要查 DJ 风格或阵容可以具体问我，例如「有哪些 Techno DJ」。',
      '说「帮我规划行程」可生成出行攻略。',
    ].filter(Boolean);

    return composeReply(lines);
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
