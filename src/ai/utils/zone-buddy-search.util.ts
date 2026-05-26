/** 解析区域/座位查询，如 13号A → 13号A区 */
export function parseZoneBuddySearchLabel(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const short = text.match(/^(\d+)\s*号\s*([A-Za-z])\s*区?$/);
  if (short) return `${short[1]}号${short[2]}区`;

  const withBuddy = text.match(
    /(\d+)\s*号\s*([A-Za-z])\s*区?.*(搭子|同行|伙伴)/,
  );
  if (withBuddy) return `${withBuddy[1]}号${withBuddy[2]}区`;

  const zoneOnly = text.match(/^([A-Za-z])\s*区\s*$/);
  if (zoneOnly) return `${zoneOnly[1]}区`;

  return null;
}

/** 用户在问某区域/座位有没有搭子（搜现有帖，不是补充自己的帖） */
export function isZoneBuddySearchIntent(input: string): boolean {
  const text = input.trim();
  if (!text || text.length > 60) return false;

  if (parseZoneBuddySearchLabel(text)) return true;

  return (
    /(有没有|有没|有).*(搭子|同行|伙伴|组队)/.test(text) &&
    /(\d+\s*号|[A-Za-z]\s*区|号\s*[A-Za-z])/.test(text)
  );
}

export function buildZoneBuddySearchQuery(input: string): string {
  const zone = parseZoneBuddySearchLabel(input);
  const base = input.trim();
  if (zone) {
    return `${zone} 搭子 同行 组队`;
  }
  return `${base} 搭子 同行`;
}

export function buildZoneMatchEmptyReply(
  activityLabel: string,
  zoneLabel: string,
): string {
  return [
    `暂未在「${activityLabel}」找到「${zoneLabel}」相关的搭子/组队帖 🔍`,
    '',
    '你可以：',
    '· 在活动详情页浏览其他区域的组队帖并申请加入',
    '· 告诉我日期、人数、出发城市，我帮你在本活动发一条组队帖',
  ].join('\n');
}

export function buildZoneMatchFoundReply(
  activityLabel: string,
  zoneLabel: string,
  matchLines: string[],
): string {
  return [
    `在「${activityLabel}」找到 ${matchLines.length} 条与「${zoneLabel}」相关的组队帖：`,
    '',
    ...matchLines,
    '',
    '可在活动详情页查看帖子并申请加入；若不合适，告诉我你的具体需求我再帮你找。',
  ].join('\n');
}
