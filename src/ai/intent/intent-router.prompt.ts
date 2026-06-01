/** Intent Router LLM：活动上下文 + few-shot（规则仅保留 3 条快路径） */

export interface IntentRouterActivityContext {
  name?: string;
  date?: string;
  /** 由 catalog 日期推导，如 6月13日、6月14日 */
  eventDaysLabel?: string;
}

export const INTENT_ROUTER_FEW_SHOTS: Array<{
  user: string;
  activity?: string;
  intent: string;
  searchHint?: string;
}> = [
  {
    user: '13号 A区 有人吗',
    activity: '风暴电音节 深圳站，日期 06/13-14，场次 6月13日、6月14日',
    intent: 'search_posts',
    searchHint: '6月13日、13号A区',
  },
  {
    user: '13号A',
    activity: '风暴电音节 深圳站，日期 06/13-14',
    intent: 'search_posts',
    searchHint: '6月13日、13号A区',
  },
  {
    user: '13号 A',
    activity: '风暴电音节 深圳站，日期 06/13-14',
    intent: 'search_posts',
    searchHint: '6月13日',
  },
  {
    user: 'A区有没有搭子',
    activity: 'EDC China，日期 03/22-23',
    intent: 'search_posts',
    searchHint: 'A区',
  },
  {
    user: '帮我看看有没有类似的组队帖',
    activity: '已绑定活动',
    intent: 'search_posts',
    searchHint: '组队帖',
  },
  {
    user: '2人 上海出发',
    activity: '已绑定活动，助手刚问过人数城市',
    intent: 'create_post',
  },
  {
    user: '确认发布',
    activity: '已绑定活动',
    intent: 'create_post',
  },
  {
    user: '重新发帖',
    activity: '用户已有招募帖',
    intent: 'create_post',
  },
  {
    user: '帮我dd',
    activity: '未绑定活动',
    intent: 'quick_find_buddy',
  },
  {
    user: '最近有什么电音节',
    activity: '未绑定活动',
    intent: 'near_events',
  },
];

export function buildIntentRouterSystemPrompt(): string {
  const fewShotBlock = INTENT_ROUTER_FEW_SHOTS.map((ex, i) =>
    [
      `示例${i + 1}:`,
      `用户: ${ex.user}`,
      ex.activity ? `活动: ${ex.activity}` : '',
      `→ {"intent":"${ex.intent}"${ex.searchHint ? `,"searchHint":"${ex.searchHint}"` : ''}}`,
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n');

  return [
    '你是聊天意图路由器。根据用户最新一条消息（结合简短上下文）判断应执行的操作。',
    '只输出 JSON，字段：',
    '- intent: 必填',
    '  - search_posts: 在活动下找现有组队帖/搭子（含某区、某天、有没有人、13号A 等）',
    '  - create_post: 发帖、组队招募、补充人数城市后发布、确认发布、重新发帖',
    '  - quick_find_buddy: 未绑定活动时点击「帮我组队/dd」类快捷入口',
    '  - near_events: 查最近/热门活动',
    '  - chitchat: 闲聊或无法判断',
    '- searchHint: search_posts 时必填，检索用简短中文（如 6月13日、13号A区、A区）',
    '',
    '歧义说明（绑定活动时必看）：',
    '- 「N号」常与活动 catalog 日期对齐（如 06/13-14 的 13号 多指 6月13日场次，而非日历 13 号）',
    '- 「A区/B区」可能指看台票区；若活动含 06/13，「13号A」优先理解为 6月13日 或 13号A区 票区',
    '- 问「有人吗」「有没有搭子」→ search_posts，不要 create_post',
    '',
    fewShotBlock,
  ].join('\n');
}

export function buildIntentRouterUserPrompt(params: {
  trimmed: string;
  contextLines: string;
  activity?: IntentRouterActivityContext;
}): string {
  const activityBlock = params.activity
    ? [
        '当前绑定活动：',
        `- 名称：${params.activity.name ?? '未知'}`,
        `- catalog 日期：${params.activity.date ?? '未知'}`,
        params.activity.eventDaysLabel
          ? `- 场次日：${params.activity.eventDaysLabel}`
          : '',
        '- 座位/票区：用户可能说 A区、B区、13号A区；结合上面场次日判断是「某天场次」还是「看台区域」',
      ]
        .filter(Boolean)
        .join('\n')
    : '未绑定具体活动';

  return [
    '用户最新消息:',
    params.trimmed,
    '',
    '上下文:',
    params.contextLines || '(无)',
    '',
    activityBlock,
  ].join('\n');
}
