import type { LlmFindBuddyVisionResult } from '../parser/llm-slot-parser.types';
import type { LlmTicketSlotResult } from '../parser/llm-slot-parser.types';

export function scoreTicketVision(result: LlmTicketSlotResult | null): number {
  if (!result) return 0;
  let score = 0;
  if (result.skuCode) score += 2;
  if (result.quantity != null && result.quantity > 0) score += 1;
  if (result.eventDate) score += 1;
  if (result.activityId || result.activityKeyword) score += 1;
  if (result.price != null && result.price > 0) score += 0.5;
  return score;
}

export function scoreFindBuddyVision(
  result: LlmFindBuddyVisionResult | null,
): number {
  if (!result) return 0;
  let score = 0;
  if (result.packageName) score += 2;
  if (result.hotelName) score += 2;
  if (result.packageOptions?.length) score += 2;
  if (result.packagePrice != null && result.packagePrice > 0) score += 1;
  if (result.transportNote) score += 1;
  if (result.budget != null && result.budget > 0) score += 0.5;
  return score;
}

export function isAmbiguousImageInference(
  ticketScore: number,
  buddyScore: number,
): boolean {
  return (
    ticketScore >= 2 &&
    buddyScore >= 2 &&
    Math.abs(ticketScore - buddyScore) < 2
  );
}

export function inferListingTypeFromHint(input: string): 'sell' | 'buy' {
  return /收票|求购/.test(input) ? 'buy' : 'sell';
}
