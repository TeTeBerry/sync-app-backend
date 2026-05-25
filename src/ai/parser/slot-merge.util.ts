import {
  normalizeActivityInput,
  resolveActivityId,
  shouldTreatNumberAsYearNotPrice,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import { isFieldCorrection } from './correction-intent.util';
import type { LlmTicketSlotResult } from './llm-slot-parser.types';
import { buildLlmFieldMeta, pickStrongerMeta } from './rule-slot-meta.util';
import type {
  FieldMeta,
  SlotSource,
  TicketDraftField,
  TicketDraftMeta,
} from './slot-meta.types';
import { TICKET_DRAFT_FIELDS } from './slot-meta.types';

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

function valuesEqual(field: TicketDraftField, a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a).trim() === String(b).trim();
}

export function sanitizeLlmTicketPatch(
  llm: LlmTicketSlotResult | null | undefined,
): Partial<TicketDraft> {
  if (!llm) return {};

  const patch: Partial<TicketDraft> = {};

  if (llm.activityKeyword?.trim()) {
    patch.activityKeyword = normalizeActivityInput(llm.activityKeyword);
  }

  if (llm.activityId?.trim()) {
    const code = llm.activityId.toLowerCase().trim();
    if (VALID_ACTIVITY_IDS.has(code)) {
      patch.activityId = code;
    }
  }

  if (llm.eventDate) {
    patch.eventDate = normalizeDate(llm.eventDate);
  }

  if (llm.skuCode?.trim()) {
    patch.skuCode = llm.skuCode.trim().slice(0, 20);
  }

  if (llm.quantity != null && llm.quantity > 0) {
    patch.quantity = Math.floor(llm.quantity);
  }

  if (
    llm.price != null &&
    llm.price > 0 &&
    !shouldTreatNumberAsYearNotPrice(llm.price, llm.eventDate ?? '', {
      eventDate: llm.eventDate ?? undefined,
    })
  ) {
    patch.price = llm.price;
  }

  if (llm.contact?.trim()) {
    patch.contact = llm.contact.trim().slice(0, 64);
  }

  if (patch.activityKeyword && !patch.activityId) {
    patch.activityId = resolveActivityId(patch.activityKeyword);
  }

  return patch;
}

interface SlotCandidate {
  value: TicketDraft[TicketDraftField];
  meta: FieldMeta;
}

function buildCandidate(
  field: TicketDraftField,
  value: TicketDraft[TicketDraftField] | undefined,
  meta: FieldMeta | undefined,
): SlotCandidate | null {
  if (value == null || value === '') return null;
  if (!meta) return null;
  return { value, meta };
}

const SOURCE_PRIORITY: Record<SlotSource, number> = {
  vision: 4,
  rule: 3,
  account: 3,
  llm: 2,
  knowledge: 2,
  catalog: 2,
  rag: 2,
};

function pickBestCandidate(candidates: SlotCandidate[]): SlotCandidate | null {
  if (!candidates.length) return null;
  return candidates.reduce((best, current) => {
    if (current.meta.confidence > best.meta.confidence) return current;
    if (current.meta.confidence === best.meta.confidence) {
      const currentPriority = SOURCE_PRIORITY[current.meta.source] ?? 0;
      const bestPriority = SOURCE_PRIORITY[best.meta.source] ?? 0;
      if (currentPriority > bestPriority) return current;
    }
    return best;
  });
}

function boostAgreementMeta(
  rule?: FieldMeta,
  llm?: FieldMeta,
): FieldMeta | undefined {
  if (!rule || !llm) return pickStrongerMeta(rule, llm);
  return {
    source: 'rule',
    confidence: Math.max(rule.confidence, llm.confidence, 0.92),
    corrected: Boolean(rule.corrected || llm.corrected),
  };
}

function resolveField(params: {
  field: TicketDraftField;
  baseValue: TicketDraft[TicketDraftField] | undefined;
  baseMeta?: FieldMeta;
  visionCandidate: SlotCandidate | null;
  ruleCandidate: SlotCandidate | null;
  llmCandidate: SlotCandidate | null;
  correctionFields: Set<TicketDraftField>;
}): { value: TicketDraft[TicketDraftField] | undefined; meta?: FieldMeta } {
  const {
    field,
    baseValue,
    baseMeta,
    visionCandidate,
    ruleCandidate,
    llmCandidate,
    correctionFields,
  } = params;
  const isCorrection = isFieldCorrection(field, correctionFields);

  if (isCorrection) {
    const corrected =
      (ruleCandidate?.meta.corrected ? ruleCandidate : null) ??
      ruleCandidate ??
      visionCandidate ??
      llmCandidate;
    if (corrected) {
      return {
        value: corrected.value,
        meta: {
          ...corrected.meta,
          confidence: 1,
          corrected: true,
        },
      };
    }
  }

  const candidates: SlotCandidate[] = [];
  if (visionCandidate) candidates.push(visionCandidate);
  if (ruleCandidate) candidates.push(ruleCandidate);
  if (llmCandidate) candidates.push(llmCandidate);

  if (
    visionCandidate &&
    ruleCandidate &&
    valuesEqual(field, visionCandidate.value, ruleCandidate.value)
  ) {
    const agreed: SlotCandidate = {
      value: visionCandidate.value,
      meta: boostAgreementMeta(ruleCandidate.meta, visionCandidate.meta) ?? ruleCandidate.meta,
    };
    if (baseValue == null || baseValue === '') {
      return { value: agreed.value, meta: agreed.meta };
    }
    if (valuesEqual(field, baseValue, agreed.value)) {
      return {
        value: baseValue,
        meta: pickStrongerMeta(baseMeta, agreed.meta),
      };
    }
    if (!baseMeta || agreed.meta.confidence >= baseMeta.confidence) {
      return { value: agreed.value, meta: agreed.meta };
    }
    return { value: baseValue, meta: baseMeta };
  }

  if (
    ruleCandidate &&
    llmCandidate &&
    valuesEqual(field, ruleCandidate.value, llmCandidate.value)
  ) {
    const agreed: SlotCandidate = {
      value: ruleCandidate.value,
      meta: boostAgreementMeta(ruleCandidate.meta, llmCandidate.meta) ?? ruleCandidate.meta,
    };
    if (baseValue == null || baseValue === '') {
      return { value: agreed.value, meta: agreed.meta };
    }
    if (valuesEqual(field, baseValue, agreed.value)) {
      return {
        value: baseValue,
        meta: pickStrongerMeta(baseMeta, agreed.meta),
      };
    }
    if (!baseMeta || agreed.meta.confidence >= baseMeta.confidence) {
      return { value: agreed.value, meta: agreed.meta };
    }
    return { value: baseValue, meta: baseMeta };
  }

  if (baseValue == null || baseValue === '') {
    const winner = pickBestCandidate(candidates);
    return winner
      ? { value: winner.value, meta: winner.meta }
      : { value: undefined, meta: undefined };
  }

  const best = pickBestCandidate(candidates);
  if (!best) {
    return { value: baseValue, meta: baseMeta };
  }

  if (valuesEqual(field, baseValue, best.value)) {
    return {
      value: baseValue,
      meta: pickStrongerMeta(baseMeta, best.meta),
    };
  }

  const threshold = (baseMeta?.confidence ?? 0) + 0.05;
  if (best.meta.confidence >= threshold) {
    return { value: best.value, meta: best.meta };
  }

  if (baseMeta && best.meta.confidence === baseMeta.confidence) {
    const bestPriority = SOURCE_PRIORITY[best.meta.source] ?? 0;
    const basePriority = baseMeta.source
      ? SOURCE_PRIORITY[baseMeta.source] ?? 0
      : 0;
    if (bestPriority > basePriority) {
      return { value: best.value, meta: best.meta };
    }
  }

  return { value: baseValue, meta: baseMeta };
}

export interface MergeTicketSlotsParams {
  baseDraft: TicketDraft;
  baseMeta?: TicketDraftMeta;
  visionPatch?: Partial<TicketDraft>;
  visionMeta?: TicketDraftMeta;
  rulePatch: Partial<TicketDraft>;
  ruleMeta: TicketDraftMeta;
  llmPatch: Partial<TicketDraft>;
  llmMeta: TicketDraftMeta;
  correctionFields: Set<TicketDraftField>;
  listingType: 'sell' | 'buy';
}

export interface MergeTicketSlotsResult {
  draft: TicketDraft;
  meta: TicketDraftMeta;
}

/** 规则 + LLM 合并：纠正优先 → 置信度 → 同值加成 → 默认规则优先 */
export function mergeTicketSlots(params: MergeTicketSlotsParams): MergeTicketSlotsResult {
  const draft: TicketDraft = { ...params.baseDraft, type: params.listingType };
  const meta: TicketDraftMeta = { ...params.baseMeta };

  for (const field of TICKET_DRAFT_FIELDS) {
    const resolved = resolveField({
      field,
      baseValue: params.baseDraft[field],
      baseMeta: params.baseMeta?.[field],
      visionCandidate: buildCandidate(
        field,
        params.visionPatch?.[field],
        params.visionMeta?.[field],
      ),
      ruleCandidate: buildCandidate(field, params.rulePatch[field], params.ruleMeta[field]),
      llmCandidate: buildCandidate(field, params.llmPatch[field], params.llmMeta[field]),
      correctionFields: params.correctionFields,
    });

    if (resolved.value == null || resolved.value === '') {
      delete draft[field];
      delete meta[field];
      continue;
    }

    draft[field] = resolved.value as never;
    if (resolved.meta) {
      meta[field] = resolved.meta;
    }
  }

  if (draft.activityKeyword && !draft.activityId) {
    draft.activityId = resolveActivityId(draft.activityKeyword);
    if (draft.activityId && !meta.activityId) {
      meta.activityId = meta.activityKeyword ?? {
        source: 'rule' as SlotSource,
        confidence: 0.85,
      };
    }
  }

  return { draft, meta };
}

/** @deprecated 使用 mergeTicketSlots */
export function mergeTicketDraftFromLlm(
  draft: TicketDraft,
  llm: LlmTicketSlotResult | null | undefined,
): void {
  const llmPatch = sanitizeLlmTicketPatch(llm);
  const llmMeta = buildLlmFieldMeta(llmPatch, new Set());
  const merged = mergeTicketSlots({
    baseDraft: draft,
    baseMeta: {},
    rulePatch: {},
    ruleMeta: {},
    llmPatch,
    llmMeta,
    correctionFields: new Set(),
    listingType: draft.type ?? 'sell',
  });
  Object.assign(draft, merged.draft);
}

export function mergeFindBuddyFromLlm(
  findBuddy: import('../conversation/conversation-state.types').FindBuddyState,
  llm: import('./llm-slot-parser.types').LlmFindBuddySlotResult | null | undefined,
): import('../conversation/conversation-state.types').FindBuddyState {
  if (!llm) return findBuddy;

  const next = { ...findBuddy };

  if (llm.activityKeyword?.trim() && !next.activityKeyword) {
    next.activityKeyword = normalizeActivityInput(llm.activityKeyword);
  }

  if (llm.activityId?.trim()) {
    const code = llm.activityId.toLowerCase().trim();
    if (VALID_ACTIVITY_IDS.has(code) && !next.activityId) {
      next.activityId = code;
    }
  } else if (next.activityKeyword && !next.activityId) {
    next.activityId = resolveActivityId(next.activityKeyword);
  }

  if (!next.eventDate && llm.eventDate) {
    next.eventDate = normalizeDate(llm.eventDate);
  }

  if (!next.peopleCount && llm.peopleCount != null && llm.peopleCount > 0) {
    next.peopleCount = Math.floor(llm.peopleCount);
  }

  if (!next.city && llm.city?.trim()) {
    next.city = llm.city.trim().slice(0, 32);
  }

  if (!next.packageName && llm.packageName?.trim()) {
    next.packageName = llm.packageName.trim().slice(0, 64);
  }

  if (!next.hotelName && llm.hotelName?.trim()) {
    next.hotelName = llm.hotelName.trim().slice(0, 64);
  }

  if (!next.location && llm.location?.trim()) {
    next.location = llm.location.trim().slice(0, 64);
  }

  if (!next.budget && llm.budget != null && llm.budget > 0 && llm.priceUnit === 'per_person') {
    next.budget = llm.budget;
  }

  if (!next.packagePrice && llm.packagePrice != null && llm.packagePrice > 0) {
    next.packagePrice = llm.packagePrice;
  } else if (
    !next.packagePrice &&
    llm.budget != null &&
    llm.budget > 0 &&
    llm.priceUnit !== 'per_person'
  ) {
    next.packagePrice = llm.budget;
  }

  if (!next.transportNote && llm.transportNote?.trim()) {
    next.transportNote = llm.transportNote.trim().slice(0, 120);
  }

  return next;
}
