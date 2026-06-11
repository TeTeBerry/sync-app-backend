import { parseConversationContext } from '../conversation/conversation-context.parser';
import { resolveActivityId } from '../utils/activity-id.util';
import { resolveFestivalBrand } from '../rag/festival-brand.util';
import type { ChatMessageDto } from '../../shared/chat';

/** Extra tokens → catalog lookup keyword (name / alias / code). */
const EVENT_HINT_KEYWORDS: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /风暴|storm/i, keyword: '风暴电音节' },
  { pattern: /\bASOT\b/i, keyword: 'ASOT' },
  { pattern: /\bEDC\b/i, keyword: 'edc' },
  { pattern: /ultra|tomorrowland|tmw/i, keyword: 'ultra' },
  { pattern: /\bVAC\b|vision\s*&\s*colour/i, keyword: 'vac' },
  { pattern: /creamfields|百威/i, keyword: 'creamfields' },
];

function collectUserHaystack(
  messages: ChatMessageDto[],
  input: string,
): string {
  const parts = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content?.trim())
    .filter((content): content is string => Boolean(content));
  const trimmed = input.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join('\n');
}

/**
 * Keywords to pass to ActivityService.resolveActivityByKeyword when the chat has no bound
 * activity (homepage / global AI). Order: most specific context first.
 */
export function extractActivityLookupKeywords(
  messages: ChatMessageDto[],
  input: string,
): string[] {
  const keywords = new Set<string>();
  const trimmed = input.trim();
  const haystack = collectUserHaystack(messages, input);
  const ctx = parseConversationContext(messages, trimmed);

  if (ctx.activityKeyword?.trim()) {
    keywords.add(ctx.activityKeyword.trim());
  }
  if (ctx.activityId?.trim()) {
    keywords.add(ctx.activityId.trim());
  }

  const activityId = resolveActivityId(haystack || trimmed);
  if (activityId) {
    keywords.add(activityId);
  }

  const festival = resolveFestivalBrand(haystack || trimmed);
  if (festival) {
    keywords.add(festival.brand.name);
    keywords.add(festival.matchedKeyword);
    keywords.add(festival.brand.code);
  }

  for (const { pattern, keyword } of EVENT_HINT_KEYWORDS) {
    if (pattern.test(haystack || trimmed)) {
      keywords.add(keyword);
    }
  }

  return [...keywords];
}
