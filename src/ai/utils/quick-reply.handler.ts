import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import { detectUserIntent } from './user-intent';
import { buildActivityPickerPrompt, formatActivityPickerLines } from './activity-reply.util';

export async function buildQuickReplyResponse(
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
    profileService: ProfileService;
  },
  _context: { userId?: string } = {},
): Promise<string | null> {
  const intent = detectUserIntent(input);
  const { activityService } = services;

  switch (intent) {
    case 'find_buddy':
      return buildActivityPickerPrompt(
        activityService,
        '好的，我来帮你找同行搭子 🎵',
      );

    case 'sell_ticket':
      return [
        '好的，我来帮你出票 🎟️',
        '',
        '请依次告诉我：',
        '1. 活动名称（如 EDC China、EDC 泰国）',
        '2. 演出日期',
        '3. 票种（单日票 / 双日票 / VIP 等）',
        '4. 出售数量',
        '5. 单价（元/张）',
        '6. 联系方式（微信或手机号）',
        '',
        '信息齐全后我会复述请你确认，确认后立即发布到「门票出/收」。',
      ].join('\n');

    case 'buy_ticket':
      return [
        '好的，我来帮你发布收票/求购 🎫',
        '',
        '请依次告诉我：',
        '1. 活动名称（如 EDC China、EDC 泰国）',
        '2. 演出日期',
        '3. 票种（单日票 / 双日票 / VIP 等）',
        '4. 求购数量',
        '5. 预算单价（元/张）',
        '6. 联系方式（微信或手机号）',
        '',
        '信息齐全后我会复述请你确认，确认后立即发布到「门票出/收」。',
      ].join('\n');

    case 'near_events': {
      const activities = await activityService.findAll();
      return [
        '这些是平台近期热门活动 📅',
        '',
        formatActivityPickerLines(activities),
        '',
        '你对哪个活动感兴趣？我可以帮你找搭子、拼单，或协助出票/收票。',
      ].join('\n');
    }

    default:
      return null;
  }
}
