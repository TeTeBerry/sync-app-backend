import type { ConversationState } from '../conversation';
import {
  isActiveItineraryTask,
  isActiveTravelGuideTask,
} from '../conversation';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';

/** Chip / exact submit labels aligned with sync-app `aiCtaLabels` + labelAliases. */
export const LINEUP_OVERVIEW_FAST_PATH_INPUTS = new Set([
  '查阵容',
  '阵容',
  '艺人名单',
  'Lineup info',
]);

export const TRAVEL_GUIDE_SHEET_FAST_PATH_INPUTS = new Set([
  '生成出行攻略',
  'Generate travel guide',
]);

export const ITINERARY_SHEET_FAST_PATH_INPUTS = new Set([
  '生成专属行程',
  'Build my itinerary',
]);

export const BUDDY_POST_FAST_PATH_INPUTS = new Set([
  '组队发帖',
  'Post buddy thread',
]);

export const PERSONALITY_TEST_FAST_PATH_INPUTS = new Set([
  '开始人格测试',
  'Start persona test',
]);

export const NEAR_EVENTS_FAST_PATH_INPUTS = new Set([
  '最近有什么活动',
  'Events coming up',
  '查最近活动',
  'Show nearby events',
]);

export const PICK_FESTIVAL_FAST_PATH_INPUTS = new Set([
  '选一场电音节',
  'Pick a festival',
]);

export type ReadOnlyFastPathKind =
  | 'lineup'
  | 'schedule'
  | 'travel_guide_sheet'
  | 'itinerary_sheet'
  | 'near_events'
  | 'festival_catalog';

export const SCHEDULE_OVERVIEW_FAST_PATH_INPUTS = new Set([
  '查时间表',
  '时间表',
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

export function isBuddyPostFastPathInput(input: string): boolean {
  return BUDDY_POST_FAST_PATH_INPUTS.has(input.trim());
}

export function isNearEventsFastPathInput(input: string): boolean {
  return NEAR_EVENTS_FAST_PATH_INPUTS.has(input.trim());
}

export function isScheduleOverviewFastPathInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (SCHEDULE_OVERVIEW_FAST_PATH_INPUTS.has(trimmed)) {
    return true;
  }
  return /^查.*时间表$/.test(trimmed) && trimmed.length <= 12;
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

  if (isBuddyPostFastPathInput(trimmed)) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (
    PERSONALITY_TEST_FAST_PATH_INPUTS.has(trimmed) ||
    PICK_FESTIVAL_FAST_PATH_INPUTS.has(trimmed)
  ) {
    return { kind: 'quick_reply', source: 'rule' };
  }

  if (NEAR_EVENTS_FAST_PATH_INPUTS.has(trimmed)) {
    return {
      kind: 'quick_reply',
      source: 'rule',
      readOnlyFastPath: 'near_events',
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
  if (routed?.kind === 'create_post' && routed.source === 'rule') {
    return true;
  }
  return routed?.kind === 'dj_info' && routed.source === 'rule';
}
