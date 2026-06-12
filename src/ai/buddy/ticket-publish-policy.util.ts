import { inferIntentTagsFromText } from './infer-intent-tags.util';
import { inferPostContentTypes } from '../../modules/partner/utils/post-content-type.util';

export const TICKET_PUBLISH_FORBIDDEN_MESSAGE =
  '平台禁止发布转票、出票、票务相关信息。如需结伴同行，请改为组队、同路或住宿类帖子。';

/** Explicit ticket-trade keywords — always block publish. */
const TICKET_PUBLISH_KEYWORD_RE = /转票|出票|票务|倒票|黄牛/i;

/** Resale phrasing without the explicit keywords above. */
const TICKET_RESALE_BODY_RE =
  /折价|出手|转让|临时有事.*票|VIP.*票|Stage.*票|内场票|看台票/i;

/** 进场/分区拼卡（#拼卡），与转票、出票不同 */
const BUDDY_PINCARD_RE = /#拼卡|找卡座/i;

function isBuddyPincardIntent(body: string, tags: string[]): boolean {
  const combined = [body, ...tags].join('\n');
  return (
    BUDDY_PINCARD_RE.test(combined) && !TICKET_PUBLISH_KEYWORD_RE.test(combined)
  );
}

export function isTicketPublishProhibited(params: {
  body?: string;
  tags?: string[];
  contentTypes?: string[];
}): boolean {
  const body = params.body?.trim() ?? '';
  const tags = params.tags ?? [];
  const combined = [body, ...tags].join('\n');

  if (isBuddyPincardIntent(body, tags)) {
    return false;
  }

  if (TICKET_PUBLISH_KEYWORD_RE.test(combined)) {
    return true;
  }

  const contentTypes = params.contentTypes?.length
    ? params.contentTypes
    : inferPostContentTypes({ tags, body });

  if (contentTypes.includes('ticket')) {
    return true;
  }

  if (
    TICKET_RESALE_BODY_RE.test(body) &&
    /票|VIP|Stage|内场|看台/i.test(body)
  ) {
    return true;
  }

  return false;
}

/** User is selling / transferring tickets (not buddy/carpool intent). */
export function isTicketResaleIntent(input: string): boolean {
  const text = input.trim();
  if (!text) return false;

  return isTicketPublishProhibited({
    body: text,
    tags: inferIntentTagsFromText(text),
  });
}
