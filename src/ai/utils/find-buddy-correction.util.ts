import type { FindBuddyState } from '../conversation/conversation-state.types';
import { resolveActivityId } from './ticket-draft.parser';
import { isActivityKeywordInput } from './conversation-context.parser';

/** 用户想重新开始找搭子（应清空旧活动/拼单上下文） */
export function isFindBuddyRestartRequest(input: string): boolean {
  const text = input.trim();
  return /重新\s*(找|拼)\s*搭子|重新\s*拼|重新\s*匹配|换个?\s*搭子|重来一次?|重新\s*开始|重新来/.test(
    text,
  );
}

const EXCLUDE_ACTIVITY_RE =
  /(?:不去|不要|别去|不是|不想(?:去|参加)?|不去参(?:加)?)\s*([a-zA-Z0-9\u4e00-\u9fff]{1,24})/gi;

/** 从「不去 EDC」等表述中提取被排除的活动片段 */
export function parseExcludedActivityRefs(input: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  EXCLUDE_ACTIVITY_RE.lastIndex = 0;
  while ((match = EXCLUDE_ACTIVITY_RE.exec(input)) !== null) {
    const chunk = match[1].trim().replace(/\s+/g, ' ');
    if (chunk) refs.push(chunk);
  }
  return refs;
}

export function resolveExcludedActivityIds(refs: string[]): Set<string> {
  const ids = new Set<string>();
  for (const ref of refs) {
    const id = resolveActivityId(ref);
    if (!id) continue;
    ids.add(id);
    if (id === 'edc') ids.add('edc-thailand');
  }
  return ids;
}

function keywordMatchesExcludedRef(
  keyword: string | undefined,
  ref: string,
): boolean {
  if (!keyword?.trim()) return false;
  const refCompact = ref.replace(/\s+/g, '').toLowerCase();
  const keywordCompact = keyword.replace(/\s+/g, '').toLowerCase();
  return (
    keywordCompact.includes(refCompact) ||
    refCompact.includes(keywordCompact)
  );
}

export function isActivityExcluded(
  activityId: string | undefined,
  activityKeyword: string | undefined,
  excludedIds: Set<string>,
  excludedRefs: string[],
): boolean {
  if (activityId && excludedIds.has(activityId)) return true;

  for (const ref of excludedRefs) {
    const refId = resolveActivityId(ref);
    if (refId && activityId === refId) return true;
    if (keywordMatchesExcludedRef(activityKeyword, ref)) return true;
  }

  return false;
}

export function clearFindBuddyActivity(fb: FindBuddyState): FindBuddyState {
  return {
    ...fb,
    phase: 'pick_activity',
    activityId: undefined,
    activityKeyword: undefined,
    joinablePindanIds: [],
  };
}

/** 处理「重新找搭子」「不去 EDC」等对当前活动的修正 */
export function applyFindBuddyActivityCorrection(
  fb: FindBuddyState,
  input: string,
): FindBuddyState {
  if (isFindBuddyRestartRequest(input)) {
    return {
      phase: 'pick_activity',
      joinablePindanIds: [],
    };
  }

  const excludedRefs = parseExcludedActivityRefs(input);
  if (!excludedRefs.length) return fb;

  const excludedIds = resolveExcludedActivityIds(excludedRefs);
  if (
    !isActivityExcluded(fb.activityId, fb.activityKeyword, excludedIds, excludedRefs)
  ) {
    return fb;
  }

  return {
    ...clearFindBuddyActivity(fb),
    eventDate: fb.eventDate,
    peopleCount: fb.peopleCount,
    city: fb.city,
    packageName: fb.packageName,
    hotelName: fb.hotelName,
    location: fb.location,
    budget: fb.budget,
  };
}

/** 去掉排除语段后，解析用户真正想选的活动 */
export function parsePositiveActivityInput(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const withoutExclusions = trimmed
    .replace(EXCLUDE_ACTIVITY_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutExclusions && isActivityKeywordInput(withoutExclusions)) {
    return withoutExclusions;
  }

  const goMatch = withoutExclusions.match(
    /(?:改(?:成|为)?|换成|去|参加|想要)\s*([a-zA-Z0-9\u4e00-\u9fff]{2,16})/,
  );
  if (goMatch && resolveActivityId(goMatch[1].trim())) {
    return goMatch[1].trim();
  }

  return undefined;
}

export function stripExcludedActivityFromPatch(
  patch: Partial<FindBuddyState>,
  input: string,
): Partial<FindBuddyState> {
  const excludedRefs = parseExcludedActivityRefs(input);
  if (!excludedRefs.length) return patch;

  const excludedIds = resolveExcludedActivityIds(excludedRefs);
  if (
    !isActivityExcluded(
      patch.activityId,
      patch.activityKeyword,
      excludedIds,
      excludedRefs,
    )
  ) {
    return patch;
  }

  const next = { ...patch };
  delete next.activityId;
  delete next.activityKeyword;
  return next;
}

export function formatExcludedActivityLabel(refs: string[]): string {
  if (!refs.length) return '该活动';
  const id = resolveActivityId(refs[0]);
  if (id === 'edc-thailand') return 'EDC Thailand';
  if (id === 'edc') return 'EDC';
  if (id === 's2o') return 'S2O';
  if (id === 'ultra') return 'Ultra';
  if (id === 'tomorrowland') return 'Tomorrowland';
  return refs[0].toUpperCase();
}
