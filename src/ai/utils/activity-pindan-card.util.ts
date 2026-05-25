import type { FindBuddyState } from '../conversation/conversation-state.types';
import type { PindanJoinCardView as PindanJoinCardDto } from '../presentation/pindan-join-card.view';
import {
  buildPindanPricePerPerson,
  inferPackageGroupSize,
} from '../pindan/find-buddy-pindan-create.util';
import {
  getJoinablePindanRows,
  pickBrowseCardRow,
  type ReplyPindanRow,
} from './pindan-reply.util';

type ActivityRow = {
  legacyId?: number;
  code?: string;
  name?: string;
  date?: string;
  location?: string;
};

export function buildActivityBrowseCard(
  activity: ActivityRow,
  browseRows: ReplyPindanRow[],
  fb?: FindBuddyState,
): PindanJoinCardDto {
  const top = pickBrowseCardRow(browseRows);
  const joinableCount = getJoinablePindanRows(browseRows).length;
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
      browseRows.length > 0
        ? joinableCount > 0
          ? `${browseRows.length} 条进行中 · ${joinableCount} 条可加入`
          : `${browseRows.length} 条进行中拼单`
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
  browseCount: number,
  joinableCount = browseCount,
): string {
  if (browseCount > 0) {
    const countLine =
      joinableCount > 0
        ? `当前有 ${browseCount} 条进行中的拼单，其中 ${joinableCount} 条可加入，点击下方卡片进入活动拼单页。`
        : `当前有 ${browseCount} 条进行中的拼单（含你发起的），点击下方卡片查看。`;
    return [
      `已为你找到「${activityName}」的拼单 🎵`,
      '',
      countLine,
    ].join('\n');
  }

  return [
    `「${activityName}」暂无进行中的拼单。`,
    '',
    '点击下方卡片进入活动拼单页，也可在顶部「创建拼单」发起新拼单。',
  ].join('\n');
}
