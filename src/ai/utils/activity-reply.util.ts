import { ChatMessageDto } from '@sync/chat-contracts';
import {
  compareActivityDateAsc,
  extractYearFromText,
  isActivityEnded,
} from '../../common/utils/activity-date.util';
import { composeReply } from './reply-text.util';

export const ACTIVITY_PICKER_PROMPT = '你想参加哪个活动？';

export function parseActivityPickerIndex(input: string): number | null {
  const match = input.trim().match(/^([1-5])$/);
  return match ? Number(match[1]) : null;
}

function getPreviousAssistantMessage(
  messages: ChatMessageDto[],
): ChatMessageDto | undefined {
  const start =
    messages.length > 0 && messages[messages.length - 1].role === 'user'
      ? messages.length - 2
      : messages.length - 1;

  for (let index = start; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return messages[index];
    }
  }
  return undefined;
}

export function findAssistantBeforeIndex(
  messages: ChatMessageDto[],
  userIndex: number,
): ChatMessageDto | undefined {
  for (let index = userIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return messages[index];
    }
  }
  return undefined;
}

export function isAwaitingActivitySelection(
  messages: ChatMessageDto[],
): boolean {
  const lastUser = messages[messages.length - 1];
  if (lastUser?.role !== 'user') return false;

  const prevAssistant = getPreviousAssistantMessage(messages);
  if (!prevAssistant?.content.includes(ACTIVITY_PICKER_PROMPT)) {
    return false;
  }

  const input = lastUser.content.trim();
  return parseActivityPickerIndex(input) != null;
}

export function formatActivityPickerLines(
  rows: Array<{
    name?: string;
    date?: string;
    location?: string;
    hot?: boolean;
  }>,
  limit = 5,
): string {
  return rows
    .slice(0, limit)
    .map((row, index) => {
      const hot = row.hot ? ' 🔥' : '';
      const meta = [row.date, row.location].filter(Boolean).join(' · ');
      return `${index + 1}. ${row.name ?? '活动'}${meta ? ` — ${meta}` : ''}${hot}`;
    })
    .join('\n');
}

export function filterUpcomingActivities<
  T extends { name?: string; date?: string },
>(activities: T[], now?: Date): T[] {
  return activities.filter((activity) => {
    const yearHint =
      extractYearFromText(activity.name) ?? extractYearFromText(activity.date);
    return !isActivityEnded(activity.date, { yearHint, now });
  });
}

export function buildNearEventsReply(
  rows: Array<{
    name?: string;
    date?: string;
    location?: string;
    hot?: boolean;
  }>,
  now?: Date,
): string {
  const upcoming = filterUpcomingActivities(rows, now).sort(
    compareActivityDateAsc,
  );

  if (!upcoming.length) {
    return composeReply([
      '暂时没有进行中的活动档期 📅',
      '',
      '有新活动官宣后我会第一时间更新，也可以关注首页活动列表。',
    ]);
  }

  return composeReply([
    '这些是平台近期热门活动 📅',
    '',
    formatActivityPickerLines(upcoming),
    '',
    ACTIVITY_PICKER_PROMPT,
    '',
    '直接回复活动名或编号即可；我不会自动绑定活动，等你确认后再帮你了解活动。',
  ]);
}
