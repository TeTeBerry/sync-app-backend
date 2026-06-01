import { normalizeAiShortcutInput } from '../../common/utils/demo-owner.util';
import { inferPostContentTypes } from '../../modules/partner/utils/post-content-type.util';
import type { PostRecord } from '../../modules/partner/interfaces/post.repository.interface';
import type { BuddyMatchIntent } from './buddy-match.types';

export function intentsForShortcutTag(
  shortcut: string,
): BuddyMatchIntent[] | undefined {
  const tag = normalizeAiShortcutInput(shortcut);
  switch (tag) {
    case '拼卡':
    case '拼车同行':
      return ['carpool'];
    case '住宿同行':
      return ['lodging'];
    case '组队队友':
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
    case '拼卡':
      return (
        types.includes('carpool') ||
        /拼卡|拼车|顺路|顺风车|包车/i.test(haystack)
      );
    case '拼车同行':
      return types.includes('carpool') || /拼车|顺路|顺风车/i.test(haystack);
    case '住宿同行':
      return (
        types.includes('accommodation') || /拼房|拼住宿|住宿|酒店/i.test(haystack)
      );
    case '组队队友':
      return (
        types.includes('team') ||
        /组队|搭子|同行|缺\d|有人吗/i.test(haystack)
      );
    default:
      return true;
  }
}
