import { ChatMessageDto } from '../dto/chat.dto';
import { ActivityService } from '../../modules/activity/activity.service';

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

/** 上一条助手消息在问活动，且用户正在用序号/活动名回复 */
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

/** 上一条助手消息展示了可加入的拼单列表 */
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
    /【(套餐拼|酒店拼|交通拼)】/.test(prevAssistant.content) ||
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

export async function buildActivityPickerPrompt(
  activityService: ActivityService,
  intro: string,
): Promise<string> {
  const activities = await activityService.findAll();
  return [
    intro,
    '',
    ACTIVITY_PICKER_PROMPT,
    formatActivityPickerLines(activities),
    '',
    '直接回复活动名（如 EDC、S2O），我会帮你看可加入的拼单，或协助发起新拼单。',
  ].join('\n');
}
