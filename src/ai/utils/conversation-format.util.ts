import { ChatMessageDto } from '../../shared/chat';

export const RECENT_TURN_LIMIT = 12;

export function formatConversationHistory(messages: ChatMessageDto[]): string {
  return messages
    .slice(-RECENT_TURN_LIMIT)
    .map((message) => {
      const roleLabel =
        message.role === 'assistant'
          ? '助手'
          : message.role === 'user'
            ? '用户'
            : '系统';
      return `[${roleLabel}] ${message.content.trim()}`;
    })
    .join('\n');
}
