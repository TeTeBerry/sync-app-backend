import type { TicketDraft } from './ticket-draft.parser';

export interface PriceBounds {
  min: number;
  max: number;
}

export function getDraftPriceBounds(draft: Partial<TicketDraft>): PriceBounds | null {
  const min = draft.price;
  if (min == null || min <= 0) return null;
  const max = draft.priceMax != null && draft.priceMax > min ? draft.priceMax : min;
  return { min, max };
}

export function getSlotPriceBounds(slot: Record<string, unknown>): PriceBounds | null {
  const min = Number(slot.price);
  if (!Number.isFinite(min) || min <= 0) return null;
  const rawMax = slot.priceMax != null ? Number(slot.priceMax) : min;
  const max =
    Number.isFinite(rawMax) && rawMax > min ? rawMax : min;
  return { min, max };
}

export function pricesOverlap(a: PriceBounds, b: PriceBounds): boolean {
  return a.min <= b.max && a.max >= b.min;
}

export function formatPriceLabel(
  draft: Partial<TicketDraft>,
  listingType?: 'sell' | 'buy',
): string | undefined {
  const bounds = getDraftPriceBounds(draft);
  if (!bounds) return undefined;
  const label = listingType === 'buy' || draft.type === 'buy' ? '预算' : '单价';
  if (bounds.max > bounds.min) {
    return `· ${label}：¥${bounds.min}-${bounds.max}/张`;
  }
  return `· ${label}：¥${bounds.min}/张`;
}

export function formatSlotPrice(slot: Record<string, unknown>): string {
  const bounds = getSlotPriceBounds(slot);
  if (!bounds) return '价格面议';
  if (bounds.max > bounds.min) {
    return `¥${bounds.min}-${bounds.max}`;
  }
  return `¥${bounds.min}`;
}
