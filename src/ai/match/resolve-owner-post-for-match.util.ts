import {
  isAiShortcutTag,
  normalizeAiShortcutInput,
} from '../../common/utils/demo-owner.util';
import type { PostRecord } from '../../modules/partner/interfaces/post.repository.interface';
import { pickBestMatchingPostRecord } from '../../modules/partner/utils/buddy-post-match.util';
import { inferPostContentTypes } from '../../modules/partner/utils/post-content-type.util';

function shortcutBodyHint(shortcut: string): string {
  const tag = normalizeAiShortcutInput(shortcut);
  switch (tag) {
    case '找卡座':
      return '拼卡 同路 顺风车 顺路 包车 出发';
    case '找拼房':
      return '拼住宿 拼房 酒店 同行';
    case '找组队':
      return '组队 搭子 同行 缺人';
    default:
      return shortcut.trim();
  }
}

/** Synthetic target post so we can pick the owner's recruiting post that best fits the shortcut lane. */
export function syntheticPostRecordFromShortcut(shortcut: string): PostRecord {
  const tag = normalizeAiShortcutInput(shortcut);
  const body = shortcutBodyHint(shortcut);
  const contentTypes = inferPostContentTypes({
    tags: [tag],
    body,
    buddyType: tag,
  });

  return {
    _id: 'shortcut-target',
    userId: '',
    body,
    tags: [tag.replace(/^找/, '')],
    contentTypes,
    status: 'recruiting',
  } as PostRecord;
}

/**
 * When the user has multiple recruiting posts, pick the one that aligns with the shortcut
 * (找卡座 / 找拼房 / 找组队). Otherwise use the newest recruiting post.
 */
export function resolveOwnerRecruitingPostForMatch(
  ownerPosts: PostRecord[],
  userInput?: string,
): PostRecord | null {
  if (!ownerPosts.length) return null;
  if (ownerPosts.length === 1) return ownerPosts[0]!;

  const trimmed = userInput?.trim() ?? '';
  if (trimmed && isAiShortcutTag(trimmed)) {
    const target = syntheticPostRecordFromShortcut(trimmed);
    return pickBestMatchingPostRecord(target, ownerPosts) ?? ownerPosts[0]!;
  }

  return ownerPosts[0]!;
}
