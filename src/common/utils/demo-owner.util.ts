import { DEFAULT_PROFILE_EXTERNAL_ID } from '../../modules/user/user.repository';

export const DEMO_OWNER_USER_ID = DEFAULT_PROFILE_EXTERNAL_ID;
export const DEMO_OWNER_DISPLAY_NAME = 'Zara Chen';

/** 活动详情页 AI 快捷标签（与前端 aiShortcutTags.ts 对齐） */
export const AI_SHORTCUT_TAGS = [
  '找组队',
  '找拼房',
  '找同路伙伴',
  '找卡座',
] as const;

/** 历史标签，仍视为快捷标签以兼容旧会话 */
const LEGACY_AI_SHORTCUT_TAGS = [
  '拼套票',
  '拼房同行',
  '组队队友',
  '住宿同行',
  '同路同行',
  '拼卡',
] as const;

const LEGACY_TO_CANONICAL: Record<string, (typeof AI_SHORTCUT_TAGS)[number]> = {
  组队队友: '找组队',
  住宿同行: '找拼房',
  拼房同行: '找拼房',
  同路同行: '找同路伙伴',
  拼卡: '找卡座',
};

/** 展示文案别名 → 标准快捷标签（与前端 aiShortcutTags 对齐） */
export const AI_SHORTCUT_TAG_ALIASES: Record<
  string,
  (typeof AI_SHORTCUT_TAGS)[number]
> = {
  帮我dd: '找组队',
  同路: '找同路伙伴',
};

export function normalizeAiShortcutInput(input: string): string {
  const text = input.trim();
  if (AI_SHORTCUT_TAG_ALIASES[text]) {
    return AI_SHORTCUT_TAG_ALIASES[text];
  }
  if (LEGACY_TO_CANONICAL[text]) {
    return LEGACY_TO_CANONICAL[text];
  }
  return text;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function authorNameMatches(stored: string, client?: string): boolean {
  const author = stored.trim();
  const name = client?.trim();
  if (!name || !author) return false;
  if (author === name) return true;
  const clientFirst = name.split(/\s+/)[0] ?? '';
  const authorFirst = author.split(/\s+/)[0] ?? '';
  return (
    clientFirst === authorFirst ||
    name.startsWith(`${authorFirst} `) ||
    author.startsWith(`${clientFirst} `)
  );
}

/** 当前客户端是否对应演示账号：仅通过 userId 确认，不通过 authorName 推断 */
export function isDemoOwnerClient(
  userId?: string,
  _authorName?: string,
): boolean {
  const uid = userId?.trim();
  return uid === DEMO_OWNER_USER_ID;
}

/** Mongo 查询：演示账号或真实 userId / 昵称 */
export function buildOwnerMongoFilter(
  userId?: string,
  authorName?: string,
): Record<string, unknown> {
  if (isDemoOwnerClient(userId, authorName)) {
    const firstName = DEMO_OWNER_DISPLAY_NAME.split(/\s+/)[0] ?? 'Zara';
    return {
      $or: [
        { userId: DEMO_OWNER_USER_ID },
        { authorName: DEMO_OWNER_DISPLAY_NAME },
        { authorName: 'Zara' },
        { authorName: { $regex: `^${escapeRegex(firstName)}`, $options: 'i' } },
      ],
    };
  }

  const clauses: Record<string, unknown>[] = [];
  const uid = userId?.trim();
  const name = authorName?.trim();

  if (uid) {
    clauses.push({ userId: uid });
  }
  if (name) {
    clauses.push({ authorName: name });
    const first = name.split(/\s+/)[0];
    if (first) {
      clauses.push({
        authorName: { $regex: `^${escapeRegex(first)}`, $options: 'i' },
      });
    }
  }

  if (clauses.length === 0) {
    return { _id: null };
  }
  return { $or: clauses };
}

/** 帖子 / 拼单等资源是否属于当前请求用户 */
export function isResourceOwnedByClient(
  record: { userId?: string; authorName?: string },
  userId?: string,
  authorName?: string,
): boolean {
  const uid = userId?.trim();
  const name = authorName?.trim();

  if (uid && record.userId === uid) return true;
  if (name && record.authorName && authorNameMatches(record.authorName, name)) {
    return true;
  }
  if (isDemoOwnerClient(uid, name) && record.userId === DEMO_OWNER_USER_ID) {
    return true;
  }
  return false;
}

export function isAiShortcutTag(input: string): boolean {
  const text = normalizeAiShortcutInput(input);
  if ((AI_SHORTCUT_TAGS as readonly string[]).includes(text)) return true;
  return (LEGACY_AI_SHORTCUT_TAGS as readonly string[]).includes(text);
}
