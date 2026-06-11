/**
 * 帖子内容类型（同类型限制的基础）
 * 支持交集：一个帖子可以同时属于多个类型
 */
export type PostContentType =
  | 'team'
  | 'accommodation'
  | 'carpool'
  | 'ticket'
  | 'share'
  | 'other';

const CONTENT_TYPE_LABELS: Record<PostContentType, string> = {
  team: '组队队友',
  accommodation: '住宿同行',
  carpool: '同路同行',
  ticket: '转票',
  share: '现场分享',
  other: '其他',
};

/** 标签/快捷词 → 内容类型映射 */
const TAG_TO_TYPE: Record<string, PostContentType> = {
  组队队友: 'team',
  组队: 'team',
  找组队: 'team',
  求组队: 'team',
  住宿同行: 'accommodation',
  拼房: 'accommodation',
  拼房同行: 'accommodation',
  住宿: 'accommodation',
  酒店: 'accommodation',
  同路同行: 'carpool',
  同路: 'carpool',
  拼卡: 'carpool',
  顺路: 'carpool',
  顺风车: 'carpool',
  转票: 'ticket',
  出票: 'ticket',
  票务: 'ticket',
  折价: 'ticket',
  现场: 'share',
  分享: 'share',
  电音: 'share',
};

/** buddyType → 内容类型映射 */
const BUDDY_TYPE_TO_TYPE: Record<string, PostContentType> = {
  住宿同行: 'accommodation',
  同路: 'carpool',
  观演: 'team',
  组队: 'team',
};

/** 正文关键词 → 内容类型映射（支持交集，全部匹配） */
const BODY_PATTERNS: Array<{ pattern: RegExp; type: PostContentType }> = [
  {
    pattern:
      /转票|出票|折价出|转手|转让|出一张.*票|舞台票|临时有事.*票|VIP.*票|Stage.*票/i,
    type: 'ticket',
  },
  { pattern: /拼房|住宿|酒店|同房|合住/i, type: 'accommodation' },
  { pattern: /拼卡|同路|顺路|顺风车|接送|包车/i, type: 'carpool' },
  {
    pattern:
      /组队|找组队|求组队|搭子|结伴|同行|姐妹|兄弟|cpdd|有人吗|有姐妹|缺\d|[A-Za-z]区|\d+号/i,
    type: 'team',
  },
];

/**
 * 从标签推断所有匹配的内容类型（支持交集）
 */
export function inferContentTypesFromTags(tags: string[]): PostContentType[] {
  const types = new Set<PostContentType>();
  for (const tag of tags) {
    const normalized = tag.replace(/^#/, '').trim();
    const type = TAG_TO_TYPE[normalized];
    if (type) types.add(type);
  }
  return [...types];
}

/**
 * 从 buddyType 推断内容类型
 */
export function inferContentTypeFromBuddyType(
  buddyType?: string,
): PostContentType | null {
  if (!buddyType) return null;
  return BUDDY_TYPE_TO_TYPE[buddyType.trim()] ?? null;
}

/**
 * 从正文推断所有匹配的内容类型（支持交集）
 */
export function inferContentTypesFromBody(body: string): PostContentType[] {
  const text = body.trim();
  if (!text) return [];
  // 去掉【安全提醒】等系统备注，避免误匹配
  const userText = text.replace(/【[^】]*】/g, '');
  const types = new Set<PostContentType>();
  for (const { pattern, type } of BODY_PATTERNS) {
    if (pattern.test(userText)) types.add(type);
  }
  return [...types];
}

/**
 * 综合推断帖子的所有内容类型（支持交集）
 * 返回所有匹配的类型，不局限于单一类型
 */
export function inferPostContentTypes(params: {
  tags?: string[];
  buddyType?: string;
  body?: string;
}): PostContentType[] {
  const { tags, buddyType, body } = params;
  const allTypes = new Set<PostContentType>();

  // 从标签推断
  if (tags?.length) {
    for (const t of inferContentTypesFromTags(tags)) {
      allTypes.add(t);
    }
  }

  // 从 buddyType 推断
  const fromBuddy = inferContentTypeFromBuddyType(buddyType);
  if (fromBuddy) allTypes.add(fromBuddy);

  // 从正文推断
  if (body) {
    for (const t of inferContentTypesFromBody(body)) {
      allTypes.add(t);
    }
  }

  const result = [...allTypes];
  return result.length ? result : ['other'];
}

/**
 * 获取内容类型的展示文案
 */
export function getContentTypeLabel(type: PostContentType): string {
  return CONTENT_TYPE_LABELS[type] ?? '其他';
}

/** Posts may include image attachments (max enforced at write time). */
export const MAX_POST_IMAGES = 3;

export function postAllowsImages(_contentTypes?: string[] | null): boolean {
  return true;
}

/** Mongo filter: recruiting / team posts (excludes share-only posts). */
export const TEAM_POST_FEED_FILTER = {
  contentTypes: { $ne: 'share' },
} as const;
