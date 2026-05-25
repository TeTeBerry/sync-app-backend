import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { detectUserIntent } from './user-intent';

const TYPE_LABEL: Record<string, string> = {
  package: '套餐拼',
  hotel: '酒店拼',
  transport: '交通拼',
};

function formatPindanLines(
  rows: Array<{
    title?: string;
    type?: string;
    date?: string;
    location?: string;
    price?: number;
    joined?: number;
    total?: number;
  }>,
  limit = 3,
): string {
  if (!rows.length) {
    return '暂无开放中的拼单，你可以告诉我活动和时间，我帮你留意。';
  }

  return rows
    .slice(0, limit)
    .map((row, index) => {
      const label = TYPE_LABEL[row.type ?? ''] ?? '拼单';
      const spots =
        row.total != null && row.joined != null
          ? `，还差 ${Math.max(0, row.total - row.joined)} 人`
          : '';
      const price = row.price != null ? ` · ¥${row.price}/人` : '';
      const meta = [row.date, row.location].filter(Boolean).join(' · ');
      return `${index + 1}. 【${label}】${row.title ?? '拼单'}${meta ? `（${meta}）` : ''}${price}${spots}`;
    })
    .join('\n');
}

function formatActivityLines(
  rows: Array<{
    name?: string;
    date?: string;
    location?: string;
    hot?: boolean;
  }>,
  limit = 5,
): string {
  return rows
    .slice(0, limit)
    .map((row, index) => {
      const hot = row.hot ? ' 🔥' : '';
      const meta = [row.date, row.location].filter(Boolean).join(' · ');
      return `${index + 1}. ${row.name ?? '活动'}${meta ? ` — ${meta}` : ''}${hot}`;
    })
    .join('\n');
}

export async function buildQuickReplyResponse(
  input: string,
  services: {
    pindanService: PindanService;
    activityService: ActivityService;
  },
): Promise<string | null> {
  const intent = detectUserIntent(input);
  const { pindanService, activityService } = services;

  switch (intent) {
    case 'find_buddy': {
      const rows = await pindanService.searchFromQuery({});
      return [
        '好的，我来帮你找同行搭子 🎵',
        '',
        '平台当前开放中的拼单：',
        formatPindanLines(rows),
        '',
        '请告诉我：',
        '· 想去哪个活动？',
        '· 大概出行日期？',
        '· 从哪个城市出发？',
        '· 几个人同行？',
        '',
        '我会根据你的情况推荐最合适的搭子或拼单。',
      ].join('\n');
    }

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
        formatActivityLines(activities),
        '',
        '你对哪个活动感兴趣？我可以帮你找搭子、拼单，或协助出票/收票。',
      ].join('\n');
    }

    default:
      return null;
  }
}
