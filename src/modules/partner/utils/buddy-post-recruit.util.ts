export type RecruitStatus = 'open' | 'full';

export type RecruitSlots = {
  recruitStatus: RecruitStatus;
  slotsTotal?: number;
  slotsFilled?: number;
};

const FULL_KEYWORDS = /已满|招满|满员/;

function parseFraction(
  text: string,
): Pick<RecruitSlots, 'slotsFilled' | 'slotsTotal'> | null {
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return null;
  }
  const filled = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(filled) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return {
    slotsFilled: Math.min(Math.max(filled, 0), total),
    slotsTotal: total,
  };
}

function parseRangeHeadcount(
  text: string,
): Pick<RecruitSlots, 'slotsTotal'> | null {
  const match = text.match(/(\d+)\s*[-~～]\s*(\d+)\s*人/);
  if (!match) {
    return null;
  }
  const upper = Number.parseInt(match[2], 10);
  if (!Number.isFinite(upper) || upper <= 0) {
    return null;
  }
  return { slotsTotal: upper };
}

function parseSimpleHeadcount(
  text: string,
): Pick<RecruitSlots, 'slotsTotal'> | null {
  const match = text.match(/(\d+)\s*人/);
  if (!match) {
    return null;
  }
  const total = Number.parseInt(match[1], 10);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  return { slotsTotal: total };
}

export function parseRecruitSlotsFromText(text?: string | null): RecruitSlots {
  const normalized = text?.trim() ?? '';
  if (!normalized) {
    return { recruitStatus: 'open' };
  }

  const recruitStatus: RecruitStatus = FULL_KEYWORDS.test(normalized)
    ? 'full'
    : 'open';

  const fraction = parseFraction(normalized);
  if (fraction) {
    return { recruitStatus, ...fraction };
  }

  const range = parseRangeHeadcount(normalized);
  if (range) {
    return { recruitStatus, ...range };
  }

  const simple = parseSimpleHeadcount(normalized);
  if (simple) {
    return { recruitStatus, ...simple };
  }

  return { recruitStatus };
}

function normalizeSlotsTotal(value?: number): number | undefined {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : undefined;
}

function normalizeSlotsFilled(
  value: number | undefined,
  slotsTotal: number | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.max(0, Math.trunc(value));
  if (slotsTotal != null) {
    return Math.min(rounded, slotsTotal);
  }
  return rounded;
}

export function normalizeRecruitFields(input: {
  recruitStatus?: RecruitStatus;
  slotsTotal?: number;
  slotsFilled?: number;
  body?: string;
}): RecruitSlots {
  const hasExplicitFields =
    input.recruitStatus != null ||
    input.slotsTotal != null ||
    input.slotsFilled != null;

  const parsed = hasExplicitFields
    ? {
        recruitStatus: input.recruitStatus ?? 'open',
        slotsTotal: normalizeSlotsTotal(input.slotsTotal),
        slotsFilled: normalizeSlotsFilled(
          input.slotsFilled,
          normalizeSlotsTotal(input.slotsTotal),
        ),
      }
    : parseRecruitSlotsFromText(input.body);

  let recruitStatus = parsed.recruitStatus ?? 'open';
  const slotsTotal = normalizeSlotsTotal(parsed.slotsTotal);
  let slotsFilled = normalizeSlotsFilled(parsed.slotsFilled, slotsTotal);

  if (recruitStatus === 'full' && slotsTotal != null && slotsFilled == null) {
    slotsFilled = slotsTotal;
  }

  if (slotsFilled != null && slotsTotal != null && slotsFilled >= slotsTotal) {
    recruitStatus = 'full';
    slotsFilled = slotsTotal;
  }

  return {
    recruitStatus,
    ...(slotsTotal != null ? { slotsTotal } : {}),
    ...(slotsFilled != null ? { slotsFilled } : {}),
  };
}
