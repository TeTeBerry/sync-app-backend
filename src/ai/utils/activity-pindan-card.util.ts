import { PindanJoinCardDto } from '../dto/chat.dto';
import type { ReplyPindanRow } from './pindan-reply.util';

type ActivityRow = {
  legacyId?: number;
  code?: string;
  name?: string;
  date?: string;
  location?: string;
};

export function buildActivityBrowseCard(
  activity: ActivityRow,
  openRows: ReplyPindanRow[],
): PindanJoinCardDto {
  const top = openRows[0];
  const category =
    top?.type === 'package' || top?.type === 'hotel' || top?.type === 'transport'
      ? top.type
      : 'package';

  const meta = [activity.date, activity.location].filter(Boolean).join(' · ');

  return {
    legacyId: top?.legacyId ?? activity.legacyId ?? 0,
    activityLegacyId: activity.legacyId,
    category,
    title: activity.name ?? activity.code ?? '活动拼单',
    subtitle:
      openRows.length > 0
        ? `${openRows.length} 条拼单可加入`
        : '暂无拼单，可发起新拼单',
    date: activity.date ?? top?.date ?? '',
    location: activity.location ?? top?.location ?? meta,
    price: top?.price ?? 0,
    activityId: activity.code,
  };
}

export function buildActivityBrowseText(
  activityName: string,
  openCount: number,
): string {
  if (openCount > 0) {
    return [
      `已为你找到「${activityName}」的拼单 🎵`,
      '',
      `当前有 ${openCount} 条可加入，点击下方卡片进入活动拼单页。`,
    ].join('\n');
  }

  return [
    `「${activityName}」暂无进行中的拼单。`,
    '',
    '点击下方卡片进入活动拼单页，也可在顶部「创建拼单」发起新拼单。',
  ].join('\n');
}
