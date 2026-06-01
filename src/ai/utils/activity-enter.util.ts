import type { Activity } from '../../database/schemas/activity.schema';
import { ChatMessageDto } from '../../shared/chat';
import type { RecommendedActivityCard } from '../../shared/chat';
import {
  ACTIVITY_PICKER_PROMPT,
  findAssistantBeforeIndex,
} from './activity-reply.util';
import { resolveActivityId } from './activity-id.util';
import { isActivityKeywordInput } from '../conversation/conversation-context.parser';
import {
  HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT,
  resolveHomeFestivalShortcutCode,
} from './festival-shortcut.util';

/** User is replying with an activity name after the assistant asked which event to enter. */
export function isAwaitingActivityEnterSelection(
  messages: ChatMessageDto[],
): boolean {
  const lastUser = messages[messages.length - 1];
  if (lastUser?.role !== 'user') return false;

  const userIndex = messages.length - 1;
  const prevAssistant = findAssistantBeforeIndex(messages, userIndex);
  if (!prevAssistant?.content) return false;

  const content = prevAssistant.content;
  return (
    content.includes(HOME_FESTIVAL_ENTER_ACTIVITY_PROMPT) ||
    content.includes(ACTIVITY_PICKER_PROMPT)
  );
}

/** Sync check: user message looks like a catalog activity name (not a numbered picker reply). */
export function isActivityEnterNameInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || /^[1-5]$/.test(trimmed)) return false;
  if (resolveHomeFestivalShortcutCode(trimmed)) return true;
  if (resolveActivityId(trimmed)) return true;
  return isActivityKeywordInput(trimmed);
}

export function buildActivityEnterConfirmationReply(
  activityName: string,
): string {
  return `好的，点下方卡片进入「${activityName}」，我可以帮你找队友或发帖。`;
}

export function toRecommendedActivityCard(
  activity: Pick<Activity, 'legacyId' | 'name' | 'date' | 'location'>,
): RecommendedActivityCard {
  return {
    activityLegacyId: activity.legacyId,
    title: activity.name?.trim() || '活动',
    date: activity.date?.trim() || undefined,
    venue: activity.location?.trim() || undefined,
  };
}
