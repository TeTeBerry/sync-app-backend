import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../presentation/chat-message.dto';

/** Embedded in assistant confirmation replies so later turns can detect pending publish. */
export const PUBLISH_CONFIRM_PROMPT_MARKER = '【发布确认】';

/** Shown as tappable chips in the client after a publish draft is ready. */
export const PUBLISH_CONFIRM_SUGGESTED_REPLIES = ['确认发布'] as const;

const PUBLISH_CONFIRM_INTENT_RE =
  /^(确认发布|确认发帖|好的[，,]?发布|发布吧|可以发布|就发吧|发吧|确认)$/;

export function isPublishConfirmIntent(input: string): boolean {
  return PUBLISH_CONFIRM_INTENT_RE.test(input.trim());
}

/** Whether the assistant already proposed a publish draft awaiting user confirmation. */
export function isAwaitingPublishConfirmation(
  messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  if (state?.flow === 'publish_confirm') {
    return true;
  }

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

/** Pull the draft paragraph from a prior 【发布确认】 assistant message. */
export function extractDraftBodyFromPublishConfirmContent(
  content: string,
): string | null {
  if (!content.includes(PUBLISH_CONFIRM_PROMPT_MARKER)) {
    return null;
  }

  const lines = content.split('\n');
  const markerIndex = lines.findIndex(line => line.includes(PUBLISH_CONFIRM_PROMPT_MARKER));
  if (markerIndex < 0) {
    return null;
  }

  // Skip the marker line and the activity label line
  let start = markerIndex + 1;
  while (start < lines.length && !lines[start].trim()) {
    start += 1;
  }
  // Skip activity label line (e.g. 「活动名」帖子预览：)
  if (start < lines.length) {
    start += 1;
  }
  while (start < lines.length && !lines[start].trim()) {
    start += 1;
  }

  const bodyLines: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^点「/.test(line.trim()) || /^想改/.test(line.trim())) {
      break;
    }
    bodyLines.push(line);
  }

  while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) {
    bodyLines.pop();
  }

  const draft = bodyLines.join('\n').trim();
  return draft || null;
}

export function buildPublishConfirmReply(params: {
  activityLabel: string;
  draftBody: string;
  shortcutTag: string;
}): string {
  const { activityLabel, draftBody, shortcutTag } = params;

  return [
    PUBLISH_CONFIRM_PROMPT_MARKER,
    `「${activityLabel}」帖子预览：`,
    '',
    draftBody,
    '',
    `点「确认发布」直接发，想改什么直接说～`,
  ].join('\n');
}
