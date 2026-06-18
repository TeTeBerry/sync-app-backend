import type { ConversationState } from '../conversation';
import {
  isActiveItineraryTask,
  isActiveTravelGuideTask,
} from '../conversation';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';

/** Chip / exact submit labels aligned with sync-app `aiCtaLabels` + capability discovery. */
export const LINEUP_OVERVIEW_FAST_PATH_INPUTS = new Set([
  '查阵容',
  '阵容',
  '艺人名单',
]);

export const TRAVEL_GUIDE_SHEET_FAST_PATH_INPUTS = new Set(['生成出行攻略']);

export const ITINERARY_SHEET_FAST_PATH_INPUTS = new Set(['生成专属行程']);

export type ReadOnlyFastPathKind =
  | 'lineup'
  | 'schedule'
  | 'travel_guide_sheet'
  | 'itinerary_sheet';

export const SCHEDULE_OVERVIEW_FAST_PATH_INPUTS = new Set([
  '查演出表',
  '演出表',
  '演出日程',
]);

export function isLineupOverviewFastPathInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (LINEUP_OVERVIEW_FAST_PATH_INPUTS.has(trimmed)) {
    return true;
  }
  return /^查.*阵容$/.test(trimmed) && trimmed.length <= 12;
}

export function isTravelGuideSheetFastPathInput(input: string): boolean {
  return TRAVEL_GUIDE_SHEET_FAST_PATH_INPUTS.has(input.trim());
}

export function isItinerarySheetFastPathInput(input: string): boolean {
  return ITINERARY_SHEET_FAST_PATH_INPUTS.has(input.trim());
}

export function isScheduleOverviewFastPathInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (SCHEDULE_OVERVIEW_FAST_PATH_INPUTS.has(trimmed)) {
    return true;
  }
  return /^查.*演出表$/.test(trimmed) && trimmed.length <= 12;
}

export function resolveReadOnlyActivityFastPath(
  trimmed: string,
  activityLegacyId: number | undefined,
  conversationState: ConversationState,
): ResolvedChatIntent | null {
  if (activityLegacyId == null || Number.isNaN(activityLegacyId) || !trimmed) {
    return null;
  }

  if (
    isActiveTravelGuideTask(conversationState) ||
    isActiveItineraryTask(conversationState)
  ) {
    return null;
  }

  if (isLineupOverviewFastPathInput(trimmed)) {
    return {
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'lineup',
    };
  }

  if (isScheduleOverviewFastPathInput(trimmed)) {
    return {
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'schedule',
    };
  }

  if (isTravelGuideSheetFastPathInput(trimmed)) {
    return {
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'travel_guide_sheet',
    };
  }

  if (isItinerarySheetFastPathInput(trimmed)) {
    return {
      kind: 'dj_info',
      source: 'rule',
      readOnlyFastPath: 'itinerary_sheet',
    };
  }

  return null;
}

export function shouldBypassAgentForReadOnlyFastPath(
  routed?: Pick<ResolvedChatIntent, 'readOnlyFastPath' | 'source' | 'kind'>,
): boolean {
  if (routed?.readOnlyFastPath) {
    return true;
  }
  if (routed?.kind === 'quick_reply' && routed.source === 'rule') {
    return true;
  }
  return routed?.kind === 'dj_info' && routed.source === 'rule';
}
