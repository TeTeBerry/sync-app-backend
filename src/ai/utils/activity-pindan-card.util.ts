import type { FindBuddyState } from '../conversation/conversation-state.types';
import { PindanJoinCardDto } from '../dto/chat.dto';
import {
  buildPindanPricePerPerson,
  inferPackageGroupSize,
} from './find-buddy-pindan-create.util';
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
  fb?: FindBuddyState,
): PindanJoinCardDto {
  const top = openRows[0];
  const category =
    top?.type === 'package' || top?.type === 'hotel' || top?.type === 'transport'
      ? top.type
      : 'package';

  const meta = [activity.date, activity.location].filter(Boolean).join(' · ');

  let pricePerPerson = top?.price ?? 0;
  if (fb && (fb.packagePrice || fb.budget) && pricePerPerson <= 0) {
    const groupSize = inferPackageGroupSize(fb);
    pricePerPerson = buildPindanPricePerPerson(fb, groupSize);
  }

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
    price: pricePerPerson,
    pricePerPerson,
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
