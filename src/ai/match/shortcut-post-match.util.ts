import { normalizeAiShortcutInput } from '../../common/utils/demo-owner.util';
import { inferPostContentTypes } from '../../modules/partner/utils/post-content-type.util';
import type { PostRecord } from '../../modules/partner/interfaces/post.repository.interface';
import type { BuddyMatchIntent } from './buddy-match.types';

export function intentsForShortcutTag(
  shortcut: string,
): BuddyMatchIntent[] | undefined {
  const tag = normalizeAiShortcutInput(shortcut);
  switch (tag) {
    case '找卡座':
      return ['carpool'];
    case '找拼房':
      return ['lodging'];
    case '找组队':
      return ['team'];
    default:
      return undefined;
  }
}

export function postMatchesShortcutTag(
  post: Pick<PostRecord, 'body' | 'tags'> & {
    contentTypes?: string[];
  },
  shortcut: string,
): boolean {
  const tag = normalizeAiShortcutInput(shortcut);
  const haystack = [post.body ?? '', ...(post.tags ?? [])].join(' ');
  const types = inferPostContentTypes({
    tags: post.tags,
    body: post.body,
    buddyType: undefined,
  });

  switch (tag) {
    case '找卡座':
      return (
        types.includes('carpool') ||
        /拼卡|同路|顺路|顺风车|包车/i.test(haystack)
      );
    case '找拼房':
      return (
        types.includes('accommodation') ||
        /拼房|拼住宿|住宿|酒店/i.test(haystack)
      );
    case '找组队':
      return (
        types.includes('team') || /组队|搭子|同行|缺\d|有人吗/i.test(haystack)
      );
    default:
      return true;
  }
}
