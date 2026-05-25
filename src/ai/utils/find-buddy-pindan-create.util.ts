import type { FindBuddyState } from '../conversation/conversation-state.types';

/** 从套餐/房型描述推断拼单人数上限（如仅大床/双床 → 2 人） */
export function inferPackageGroupSize(fb: FindBuddyState): number {
  const blob = [
    fb.packageName,
    fb.hotelName,
    fb.activityKeyword,
    fb.transportNote,
  ]
    .filter(Boolean)
    .join(' ');

  if (
    /大床|双床|大\s*\/\s*双|双人|两人|2\s*人|一间|1\s*间|two\s*person/i.test(
      blob,
    )
  ) {
    return 2;
  }

  if (
    fb.hotelName &&
    /\d+\s*天\s*\d+\s*晚|\d+天\d+晚/.test(blob)
  ) {
    return 2;
  }

  if (fb.peopleCount && fb.peopleCount >= 2 && fb.peopleCount <= 8) {
    return fb.peopleCount;
  }

  return 4;
}

export function buildPindanPricePerPerson(
  fb: FindBuddyState,
  groupSize: number,
): number {
  // packagePrice is total; budget is already per-person — prefer dividing total first
  // so a mistaken budget=packagePrice (e.g. user typed "480") does not skip division.
  if (fb.packagePrice && groupSize > 0) {
    return Math.round(fb.packagePrice / groupSize);
  }
  if (fb.budget && fb.budget > 0) return fb.budget;
  return 0;
}

export function buildPindanRemark(fb: FindBuddyState): string | undefined {
  return fb.transportNote?.trim() || undefined;
}

export function buildPindanCardSubtitle(
  joined: number,
  total: number,
): string {
  const remaining = Math.max(0, total - joined);
  if (remaining <= 0) return '已满员';
  return `${joined}/${total} 人已加入 · 还差 ${remaining} 人`;
}
