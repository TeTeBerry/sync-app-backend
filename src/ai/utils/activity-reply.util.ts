import { ChatMessageDto } from '../presentation/chat-message.dto';
import { PINDAN_TYPE_LABEL_PATTERN } from '../../common/constants/pindan-labels';

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

export function isAwaitingActivitySelection(messages: ChatMessageDto[]): boolean {
  const lastUser = messages[messages.length - 1];
  if (lastUser?.role !== 'user') return false;

  const prevAssistant = getPreviousAssistantMessage(messages);
  if (!prevAssistant?.content.includes(ACTIVITY_PICKER_PROMPT)) {
    return false;
  }

  const input = lastUser.content.trim();
  return parseActivityPickerIndex(input) != null;
}

export function isAwaitingPindanSelection(messages: ChatMessageDto[]): boolean {
  if (messages.length < 2) return false;

  const lastUser = messages[messages.length - 1];
  if (lastUser?.role !== 'user') return false;

  const prevAssistant = getPreviousAssistantMessage(messages);
  if (!prevAssistant) return false;

  if (prevAssistant.content.includes(ACTIVITY_PICKER_PROMPT)) {
    return false;
  }

  return (
    new RegExp(`【(${PINDAN_TYPE_LABEL_PATTERN})】`).test(prevAssistant.content) ||
    (/相关拼单】/.test(prevAssistant.content) &&
      /想加入已有拼单|回复序号/.test(prevAssistant.content))
  );
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
