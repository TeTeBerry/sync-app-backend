import type { TicketDraft } from '../utils/ticket-draft.parser';
import { isFieldCorrection } from './correction-intent.util';
import type { FieldMeta, TicketDraftField, TicketDraftMeta } from './slot-meta.types';
import { TICKET_DRAFT_FIELDS } from './slot-meta.types';

function hasExplicitPriceSignal(text: string): boolean {
  return /(?:价格|单价|售价|预算)\s*[:：]?\s*\d+|\d+\s*元/.test(text);
}

function scoreRuleConfidence(input: string, field: TicketDraftField): number {
  const text = input.trim();

  switch (field) {
    case 'activityKeyword':
    case 'activityId':
      if (/活动\s*(?:是|为|改成|改为)/.test(text)) return 0.98;
      if (/^(?:是|对|就是)/.test(text)) return 0.96;
      return 0.86;
    case 'eventDate':
      if (/(?:演出日期|日期)\s*(?:是|为|改成|改为)/.test(text)) return 0.98;
      if (/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/.test(text)) return 0.92;
      return 0.8;
    case 'skuCode':
      if (/票种\s*(?:是|为|改成|改为)/.test(text)) return 0.98;
      if (/^ga$|^vip$/i.test(text)) return 0.94;
      return 0.88;
    case 'quantity':
      if (/数量\s*(?:是|为|改成|改为)/.test(text)) return 0.98;
      if (/(\d+)\s*张/.test(text)) return 0.9;
      return 0.82;
    case 'price':
      if (/(?:价格|单价|售价|预算)\s*(?:是|为|改成|改为)/.test(text)) return 0.98;
      if (hasExplicitPriceSignal(text)) return 0.94;
      return 0.78;
    case 'contact':
      if (/(?:联系方式|联系)\s*(?:是|为|改成|改为)/.test(text)) return 0.98;
      if (/1\d{10}|微信/.test(text)) return 0.93;
      return 0.85;
    default:
      return 0.8;
  }
}

export function diffTicketDraft(
  before: TicketDraft,
  after: TicketDraft,
): Partial<TicketDraft> {
  const patch: Partial<TicketDraft> = {};

  for (const field of TICKET_DRAFT_FIELDS) {
    const next = after[field];
    const prev = before[field];
    if (next == null || next === '') continue;
    if (next !== prev) {
      patch[field] = next as never;
    }
  }

  return patch;
}

export function buildRuleFieldMeta(
  input: string,
  patch: Partial<TicketDraft>,
  correctionFields: Set<TicketDraftField>,
): TicketDraftMeta {
  const meta: TicketDraftMeta = {};

  for (const field of TICKET_DRAFT_FIELDS) {
    if (patch[field] == null) continue;
    const corrected = isFieldCorrection(field, correctionFields);
    meta[field] = {
      source: 'rule',
      confidence: corrected ? 1 : scoreRuleConfidence(input, field),
      corrected,
    };
  }

  return meta;
}

export function buildLlmFieldMeta(
  patch: Partial<TicketDraft>,
  correctionFields: Set<TicketDraftField>,
): TicketDraftMeta {
  const meta: TicketDraftMeta = {};

  for (const field of TICKET_DRAFT_FIELDS) {
    if (patch[field] == null) continue;
    const corrected = isFieldCorrection(field, correctionFields);
    meta[field] = {
      source: 'llm',
      confidence: corrected ? 0.95 : 0.72,
      corrected,
    };
  }

  return meta;
}

export function pickStrongerMeta(a?: FieldMeta, b?: FieldMeta): FieldMeta | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.confidence !== b.confidence) {
    return a.confidence > b.confidence ? a : b;
  }
  return a.source === 'rule' ? a : b;
}
