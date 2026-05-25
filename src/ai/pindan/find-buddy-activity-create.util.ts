import type { FindBuddyState } from '../conversation/conversation-state.types';

export type ActivityCreateSlot = 'budget' | 'peopleCount';

export function isActivityOnlyCreateContext(fb: FindBuddyState): boolean {
  if (fb.hotelName?.trim()) return false;
  if (fb.transportNote?.trim()) return false;
  if (fb.packageName?.trim()) return false;
  if (fb.packagePrice != null && fb.packagePrice > 0) return false;
  if ((fb.packageOptions?.length ?? 0) >= 2) return false;
  return Boolean(fb.activityId || fb.activityKeyword);
}

export function hasActivityCreateBudget(fb: FindBuddyState): boolean {
  if (fb.budgetMin != null && fb.budgetMax != null && fb.budgetMax >= fb.budgetMin) {
    return true;
  }
  return fb.budget != null && fb.budget > 0;
}

export function getMissingActivityCreateFields(
  fb: FindBuddyState,
): ActivityCreateSlot[] {
  const missing: ActivityCreateSlot[] = [];
  if (!hasActivityCreateBudget(fb)) missing.push('budget');
  if (!fb.peopleCount || fb.peopleCount < 2) missing.push('peopleCount');
  return missing;
}

export function resolveActivityCreatePhase(
  fb: FindBuddyState,
  noOpenPindans: boolean,
): FindBuddyState['phase'] {
  if (!noOpenPindans || !isActivityOnlyCreateContext(fb)) {
    return 'confirm_create_pindan';
  }
  return getMissingActivityCreateFields(fb).length > 0
    ? 'collect_create_pindan'
    : 'confirm_create_pindan';
}

const CN_GROUP_SIZE: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const GROUP_SIZE_TOKEN = String.raw`(?:\d+|[两二三四五六七八九十])`;

function parseGroupSizeToken(raw: string): number | undefined {
  const token = raw.trim();
  if (!token) return undefined;
  if (/^\d+$/.test(token)) return Number(token);
  const cn = CN_GROUP_SIZE[token];
  return cn != null ? cn : undefined;
}

const BARE_GE_RE = String.raw`个(?!\s*人)`;

export function parseFindBuddyGroupSize(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const patterns = [
    new RegExp(`拼\\s*(${GROUP_SIZE_TOKEN})\\s*个?\\s*人`),
    new RegExp(`想\\s*拼\\s*(${GROUP_SIZE_TOKEN})\\s*个?\\s*人`),
    new RegExp(`(${GROUP_SIZE_TOKEN})\\s*个?\\s*人\\s*拼`),
    new RegExp(`(${GROUP_SIZE_TOKEN})\\s*个?\\s*人`),
    new RegExp(`拼\\s*(${GROUP_SIZE_TOKEN})\\s*${BARE_GE_RE}`),
    new RegExp(`(?:^|[，,、；;])\\s*(${GROUP_SIZE_TOKEN})\\s*${BARE_GE_RE}(?:\\s*$|[，,、；;])`),
    new RegExp(`^(${GROUP_SIZE_TOKEN})\\s*${BARE_GE_RE}\\s*$`),
    new RegExp(`^(${GROUP_SIZE_TOKEN})\\s*个?$`),
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const value = parseGroupSizeToken(match[1]);
    if (value != null && value >= 2 && value <= 20) return Math.floor(value);
  }

  return undefined;
}

export function parseFindBuddyBudget(text: string): Partial<
  Pick<
    FindBuddyState,
    'budget' | 'budgetMin' | 'budgetMax' | 'budgetScope'
  >
> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const perPersonRangeMatch =
    trimmed.match(/人均\s*¥?\s*(\d{3,6})\s*[-~至到]\s*¥?\s*(\d{3,6})/) ??
    trimmed.match(/每人\s*¥?\s*(\d{3,6})\s*[-~至到]\s*¥?\s*(\d{3,6})/);
  if (perPersonRangeMatch) {
    const budgetMin = Number(perPersonRangeMatch[1]);
    const budgetMax = Number(perPersonRangeMatch[2]);
    if (budgetMin > 0 && budgetMax >= budgetMin) {
      return {
        budgetMin,
        budgetMax,
        budget: Math.round((budgetMin + budgetMax) / 2),
        budgetScope: 'per_person',
      };
    }
  }

  const rangeMatch =
    trimmed.match(/预算\s*(\d{3,6})\s*[-~至到]\s*(\d{3,6})/) ??
    trimmed.match(/(\d{3,6})\s*[-~至到]\s*(\d{3,6})\s*元?/) ??
    trimmed.match(/¥?\s*(\d{3,6})\s*[-~至到]\s*¥?\s*(\d{3,6})/);
  if (rangeMatch) {
    const budgetMin = Number(rangeMatch[1]);
    const budgetMax = Number(rangeMatch[2]);
    if (budgetMin > 0 && budgetMax >= budgetMin) {
      return {
        budgetMin,
        budgetMax,
        budget: Math.round((budgetMin + budgetMax) / 2),
        budgetScope: 'total',
      };
    }
  }

  const perPersonMatch =
    trimmed.match(/人均\s*¥?\s*(\d{3,6})/) ??
    trimmed.match(/每人\s*¥?\s*(\d{3,6})/) ??
    trimmed.match(/(\d{3,6})\s*元?\s*\/\s*人/);
  if (perPersonMatch) {
    const budget = Number(perPersonMatch[1]);
    if (budget > 0) return applySingleBudgetRange(budget, 'per_person');
  }

  const budgetMatch = trimmed.match(/预算\s*¥?\s*(\d{3,6})/);
  if (budgetMatch) {
    const budget = Number(budgetMatch[1]);
    if (budget > 0) return applySingleBudgetRange(budget, 'per_person');
  }

  if (/^\d{3,6}$/.test(trimmed)) {
    const budget = Number(trimmed);
    if (budget > 0) return applySingleBudgetRange(budget, 'per_person');
  }

  return {};
}

function applySingleBudgetRange(
  budget: number,
  budgetScope: FindBuddyState['budgetScope'] = 'per_person',
): Pick<
  FindBuddyState,
  'budget' | 'budgetMin' | 'budgetMax' | 'budgetScope'
> {
  const margin = Math.max(50, Math.round(budget * 0.1));
  return {
    budget,
    budgetMin: Math.max(0, budget - margin),
    budgetMax: budget + margin,
    budgetScope,
  };
}

export function resolvePerPersonBudget(
  fb: Pick<
    FindBuddyState,
    'budgetMin' | 'budgetMax' | 'budget' | 'budgetScope' | 'peopleCount'
  >,
  groupSize?: number,
): Pick<FindBuddyState, 'budgetMin' | 'budgetMax' | 'budget'> {
  const headcount = groupSize ?? fb.peopleCount;
  const toPerPerson = (value: number): number => {
    if (fb.budgetScope === 'total' && headcount != null && headcount > 0) {
      return Math.round(value / headcount);
    }
    return value;
  };

  if (fb.budgetMin != null && fb.budgetMax != null) {
    const budgetMin = toPerPerson(fb.budgetMin);
    const budgetMax = toPerPerson(fb.budgetMax);
    return {
      budgetMin,
      budgetMax,
      budget:
        fb.budget != null
          ? toPerPerson(fb.budget)
          : Math.round((budgetMin + budgetMax) / 2),
    };
  }

  if (fb.budget != null && fb.budget > 0) {
    return { budget: toPerPerson(fb.budget) };
  }

  return {};
}

export function mergeActivityCreateSlots(
  fb: FindBuddyState,
  input: string,
): FindBuddyState {
  const budgetPatch = parseFindBuddyBudget(input);
  const peopleCount = parseFindBuddyGroupSize(input);

  return {
    ...fb,
    ...budgetPatch,
    peopleCount: peopleCount ?? fb.peopleCount,
  };
}

export function formatBudgetRangeLabel(
  fb: FindBuddyState,
  groupSize?: number,
): string | undefined {
  const resolved = resolvePerPersonBudget(fb, groupSize);
  if (resolved.budgetMin != null && resolved.budgetMax != null) {
    if (resolved.budgetMin === resolved.budgetMax) {
      return `约¥${resolved.budgetMin}/人`;
    }
    return `¥${resolved.budgetMin}-${resolved.budgetMax}/人`;
  }
  if (resolved.budget != null && resolved.budget > 0) {
    return `约¥${resolved.budget}/人`;
  }
  return undefined;
}

export function inferActivityPackageGroupSize(fb: FindBuddyState): number {
  if (fb.peopleCount && fb.peopleCount >= 2 && fb.peopleCount <= 20) {
    return fb.peopleCount;
  }
  return 4;
}
