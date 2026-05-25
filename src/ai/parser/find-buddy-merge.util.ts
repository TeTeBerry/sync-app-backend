import type { FindBuddyState } from '../conversation/conversation-state.types';
import {
  hasExplicitEdcMention,
  isVacActivityContext,
  normalizeActivityInput,
  resolveActivityId,
  shouldTreatNumberAsYearNotPrice,
} from '../utils/ticket-draft.parser';
import { inferPackageGroupSize } from '../utils/find-buddy-pindan-create.util';
import {
  resolvePackageOptionsPhase,
  sanitizePackageOptions,
} from '../utils/find-buddy-package.util';
import { stripExcludedActivityFromPatch } from '../utils/find-buddy-correction.util';
import type {
  LlmFindBuddySlotResult,
  LlmFindBuddyVisionResult,
} from './llm-slot-parser.types';

const VALID_ACTIVITY_IDS = new Set([
  'edc',
  'edc-thailand',
  's2o',
  'ultra',
  'tomorrowland',
  'vac-zhuhai',
]);

function normalizeDate(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const match = raw.trim().match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return raw.trim();
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function looksLikePackageTotal(
  raw: LlmFindBuddyVisionResult | LlmFindBuddySlotResult,
): boolean {
  const blob = [raw.packageName, raw.hotelName, raw.activityKeyword]
    .filter(Boolean)
    .join(' ');
  return /天\s*\d*\s*晚|\d+\s*天\s*\d+\s*晚|套餐|package/i.test(blob);
}

function sanitizePatch(
  raw: LlmFindBuddyVisionResult | LlmFindBuddySlotResult | null | undefined,
): Partial<FindBuddyState> {
  if (!raw) return {};

  const patch: Partial<FindBuddyState> = {};
  const multiPackage =
    sanitizePackageOptions(raw.packageOptions).length >= 2;

  if (raw.activityKeyword?.trim()) {
    patch.activityKeyword = normalizeActivityInput(raw.activityKeyword);
  }

  if (raw.activityId?.trim()) {
    const code = raw.activityId.toLowerCase().trim();
    const idBlob = [
      raw.activityKeyword,
      raw.packageName,
      raw.hotelName,
    ]
      .filter(Boolean)
      .join(' ');
    if (
      (code === 'edc' || code === 'edc-thailand') &&
      !hasExplicitEdcMention(idBlob)
    ) {
      // VL 误填 EDC：无明确 EDC 字样则丢弃 activityId
    } else if (VALID_ACTIVITY_IDS.has(code)) {
      patch.activityId = code;
    }
  }

  if (raw.eventDate && !multiPackage) {
    patch.eventDate = normalizeDate(raw.eventDate);
  }

  if (raw.peopleCount != null && raw.peopleCount > 0) {
    patch.peopleCount = Math.floor(raw.peopleCount);
  }

  if (raw.city?.trim()) {
    patch.city = raw.city.trim().slice(0, 32);
  }

  if (raw.packageName?.trim() && !multiPackage) {
    patch.packageName = raw.packageName.trim().slice(0, 64);
  }

  if (raw.hotelName?.trim()) {
    patch.hotelName = raw.hotelName.trim().slice(0, 64);
  }

  if (raw.location?.trim()) {
    patch.location = raw.location.trim().slice(0, 64);
  }

  if (raw.transportNote?.trim()) {
    patch.transportNote = raw.transportNote.trim().slice(0, 120);
  }

  const priceUnit = raw.priceUnit?.toLowerCase();
  if (!multiPackage && raw.packagePrice != null && raw.packagePrice > 0) {
    if (!shouldTreatNumberAsYearNotPrice(raw.packagePrice, raw.eventDate ?? '')) {
      patch.packagePrice = raw.packagePrice;
    }
  }

  if (raw.budget != null && raw.budget > 0 && !multiPackage) {
    if (shouldTreatNumberAsYearNotPrice(raw.budget, raw.eventDate ?? '')) {
      // skip year mistaken as price
    } else if (priceUnit === 'per_person') {
      patch.budget = raw.budget;
    } else if (priceUnit === 'total' || looksLikePackageTotal(raw)) {
      patch.packagePrice = patch.packagePrice ?? raw.budget;
    } else if (!priceUnit) {
      patch.packagePrice = patch.packagePrice ?? raw.budget;
    } else {
      patch.budget = raw.budget;
    }
  }

  if (patch.activityKeyword && !patch.activityId) {
    patch.activityId = resolveActivityId(patch.activityKeyword);
  }

  return patch;
}

function pickField<K extends keyof FindBuddyState>(
  key: K,
  vision: Partial<FindBuddyState>,
  rule: FindBuddyState,
  llm: Partial<FindBuddyState>,
  base: FindBuddyState,
  lockedPackageFlow = false,
): FindBuddyState[K] | undefined {
  if (
    lockedPackageFlow &&
    (key === 'activityId' || key === 'activityKeyword')
  ) {
    const baseVal = base[key];
    if (baseVal != null && baseVal !== '') {
      return baseVal as FindBuddyState[K];
    }
    const visionVal = vision[key];
    if (visionVal != null && visionVal !== '') {
      return visionVal as FindBuddyState[K];
    }
    return undefined;
  }

  const visionVal = vision[key];
  if (visionVal != null && visionVal !== '') {
    return visionVal as FindBuddyState[K];
  }

  const ruleVal = rule[key];
  if (ruleVal != null && ruleVal !== '' && ruleVal !== base[key]) {
    return ruleVal;
  }

  const llmVal = llm[key];
  if (llmVal != null && llmVal !== '') {
    return llmVal as FindBuddyState[K];
  }

  return base[key] ?? ruleVal;
}

function sanitizeSource(
  raw: LlmFindBuddyVisionResult | LlmFindBuddySlotResult | null | undefined,
  input: string,
): Partial<FindBuddyState> {
  return stripExcludedActivityFromPatch(sanitizePatch(raw), input);
}

function buildVacKeyword(state: FindBuddyState): string {
  if (state.activityKeyword && isVacActivityContext(state.activityKeyword)) {
    return state.activityKeyword;
  }
  if (state.packageName && isVacActivityContext(state.packageName)) {
    return 'VAC 珠海电音节';
  }
  if (state.hotelName && /希尔顿|hilton/i.test(state.hotelName)) {
    return 'VAC 珠海电音节';
  }
  return 'VAC 珠海电音节';
}

function isZhuhaiHotelPackageContext(state: FindBuddyState): boolean {
  const hasZhuhai =
    /珠海|zhuhai/i.test(state.city ?? '') ||
    /珠海|zhuhai/i.test(state.hotelName ?? '') ||
    /珠海|zhuhai/i.test(state.location ?? '');
  const hasPackageContext =
    (state.packageOptions?.length ?? 0) >= 2 ||
    Boolean(state.packageName) ||
    state.packagePrice != null ||
    Boolean(state.hotelName);
  return hasZhuhai && hasPackageContext;
}

export function isLockedPackageFlow(fb: FindBuddyState): boolean {
  return (
    (fb.phase === 'pick_package' && (fb.packageOptions?.length ?? 0) >= 2) ||
    fb.phase === 'confirm_create_pindan'
  );
}

function stripUnconfirmedEdc(state: FindBuddyState): FindBuddyState {
  if (state.activityId !== 'edc' && state.activityId !== 'edc-thailand') {
    return state;
  }

  const blob = [
    state.activityKeyword,
    state.packageName,
    state.hotelName,
    state.location,
  ]
    .filter(Boolean)
    .join(' ');

  if (hasExplicitEdcMention(blob)) {
    return state;
  }

  return {
    ...state,
    activityId: isVacActivityContext(blob) ? 'vac-zhuhai' : undefined,
  };
}

export function reconcileFindBuddyActivity(state: FindBuddyState): FindBuddyState {
  const contextBlob = [
    state.activityKeyword,
    state.packageName,
    state.hotelName,
    state.location,
    state.city,
  ]
    .filter(Boolean)
    .join(' ');

  if (isZhuhaiHotelPackageContext(state)) {
    return {
      ...state,
      activityId: 'vac-zhuhai',
      activityKeyword: buildVacKeyword(state),
    };
  }

  if (isVacActivityContext(contextBlob)) {
    return {
      ...state,
      activityId: 'vac-zhuhai',
      activityKeyword: buildVacKeyword(state),
    };
  }

  if (
    state.activityId === 'edc' &&
    state.activityKeyword &&
    !/edc|阳澄湖|苏州|edc china/i.test(state.activityKeyword)
  ) {
    const resolved = resolveActivityId(state.activityKeyword);
    if (resolved && resolved !== 'edc') {
      return { ...state, activityId: resolved };
    }
  }

  if (state.activityKeyword && !state.activityId) {
    return {
      ...state,
      activityId: resolveActivityId(state.activityKeyword),
    };
  }

  if (
    state.activityId === 'tomorrowland' &&
    (isVacActivityContext(contextBlob) || isZhuhaiHotelPackageContext(state))
  ) {
    return {
      ...state,
      activityId: 'vac-zhuhai',
      activityKeyword: buildVacKeyword(state),
    };
  }

  return stripUnconfirmedEdc(state);
}

/** 图片识别 > 规则 > LLM */
export function mergeFindBuddyState(params: {
  base: FindBuddyState;
  visionRaw?: LlmFindBuddyVisionResult | null;
  ruleState: FindBuddyState;
  llmRaw?: LlmFindBuddySlotResult | null;
  input?: string;
}): FindBuddyState {
  const input = params.input ?? '';
  const vision = sanitizeSource(params.visionRaw, input);
  const llm = sanitizeSource(params.llmRaw, input);
  const base = params.base;
  const rule = params.ruleState;
  const lockedPackageFlow = isLockedPackageFlow(base);

  let next: FindBuddyState = {
    phase: base.phase,
    joinablePindanIds: base.joinablePindanIds,
    packageOptions: base.packageOptions,
    selectedPackageIndex: base.selectedPackageIndex,
    activityId: pickField('activityId', vision, rule, llm, base, lockedPackageFlow),
    activityKeyword: pickField(
      'activityKeyword',
      vision,
      rule,
      llm,
      base,
      lockedPackageFlow,
    ),
    eventDate: pickField('eventDate', vision, rule, llm, base),
    peopleCount: pickField('peopleCount', vision, rule, llm, base),
    city: pickField('city', vision, rule, llm, base),
    packageName: pickField('packageName', vision, rule, llm, base),
    hotelName: pickField('hotelName', vision, rule, llm, base),
    location: pickField('location', vision, rule, llm, base),
    budget: pickField('budget', vision, rule, llm, base),
    packagePrice: pickField('packagePrice', vision, rule, llm, base),
    transportNote: pickField('transportNote', vision, rule, llm, base),
  };

  if (lockedPackageFlow && base.activityId) {
    next = {
      ...next,
      activityId: base.activityId,
      activityKeyword: base.activityKeyword ?? next.activityKeyword,
    };
  }
  next = reconcileFindBuddyActivity(next);

  if (!next.city && next.location) {
    for (const city of [
      '上海',
      '北京',
      '广州',
      '深圳',
      '杭州',
      '成都',
      '三亚',
      '苏州',
      '珠海',
    ]) {
      if (next.location.includes(city)) {
        next.city = city;
        break;
      }
    }
  }

  if (!next.city && next.hotelName && /珠海|zhuhai/i.test(next.hotelName)) {
    next.city = '珠海';
  }

  const capacity = inferPackageGroupSize(next);
  if (capacity === 2) {
    next.peopleCount = 2;
  }

  const visionOptions = sanitizePackageOptions(params.visionRaw?.packageOptions);
  if (visionOptions.length >= 2) {
    next = resolvePackageOptionsPhase(next, visionOptions);
  } else if (next.phase === 'pick_package' && next.packageOptions?.length) {
    // 保留待选套餐状态，避免被单套餐字段覆盖
    next = {
      ...next,
      packagePrice: undefined,
      phase: 'pick_package',
    };
  }

  return next;
}

export function sanitizeFindBuddyVisionPatch(
  vision: LlmFindBuddyVisionResult | null | undefined,
): Partial<FindBuddyState> {
  return sanitizePatch(vision);
}
