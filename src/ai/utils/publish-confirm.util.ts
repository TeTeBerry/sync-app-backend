import { ChatMessageDto } from '../presentation/chat-message.dto';

/** Embedded in assistant confirmation replies so later turns can detect pending publish. */
export const PUBLISH_CONFIRM_PROMPT_MARKER = '【发布确认】';

const PUBLISH_CONFIRM_INTENT_RE =
  /^(确认发布|确认发帖|好的[，,]?发布|发布吧|可以发布|就发吧|发吧|确认)$/;

export function isPublishConfirmIntent(input: string): boolean {
  return PUBLISH_CONFIRM_INTENT_RE.test(input.trim());
}

/** Whether the assistant already proposed a publish draft awaiting user confirmation. */
export function isAwaitingPublishConfirmation(
  messages: ChatMessageDto[],
): boolean {
  const lastIndex = messages.length - 1;
  if (lastIndex < 1) return false;

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') {
      return message.content.includes(PUBLISH_CONFIRM_PROMPT_MARKER);
    }
    if (message.role === 'user') {
      return false;
    }
  }

  return false;
}

export function buildPublishConfirmReply(params: {
  activityLabel: string;
  draftBody: string;
  shortcutTag: string;
}): string {
  const { activityLabel, draftBody, shortcutTag } = params;

  return [
    PUBLISH_CONFIRM_PROMPT_MARKER,
    `为你准备了「${activityLabel}」的组队帖草稿：`,
    '',
    draftBody,
    '',
    `标签：${shortcutTag}`,
    '',
    '确认内容无误后，回复「确认发布」即可发布；若想修改，直接补充出行日期、人数或出发城市等信息。',
  ].join('\n');
}
