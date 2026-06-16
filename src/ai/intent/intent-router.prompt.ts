/** Intent Router LLM：活动上下文 + few-shot（规则仅保留 3 条快路径） */

export interface IntentRouterActivityContext {
  name?: string;
  date?: string;
  /** 由 catalog 日期推导，如 6月13日、6月14日 */
  eventDaysLabel?: string;
}

export const INTENT_ROUTER_FEW_SHOTS: Array<{
  user: string;
  context?: string;
  activity?: string;
  intent: string;
}> = [
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
    activity: '用户已有帖子',
    intent: 'create_post',
  },
  {
    user: '最近有什么电音节',
    activity: '未绑定活动',
    intent: 'near_events',
  },
  {
    user: 'Marshmello 是什么风格',
    activity: 'EDC Thailand 2026',
    intent: 'dj_info',
  },
  {
    user: '这场有哪些 Techno DJ',
    activity: 'EDC Thailand 2026',
    intent: 'dj_info',
  },
  {
    user: '介绍一下 Korolova',
    activity: '已绑定活动',
    intent: 'dj_info',
  },
  {
    user: '帮我找类似风格的DJ',
    context:
      '[user] Marshmello 什么风格\n[assistant] Marshmello 以 Future Bass、Pop EDM 为主。',
    activity: '风暴电音节 深圳站',
    intent: 'dj_info',
  },
  {
    user: '近期演出',
    context:
      '[user] Marshmello\n[assistant] Marshmello 是 Future Bass 制作人。想了解近期演出还是类似艺人？',
    activity: '未绑定活动',
    intent: 'dj_info',
  },
];

export function buildIntentRouterSystemPrompt(): string {
  const fewShotBlock = INTENT_ROUTER_FEW_SHOTS.map((ex, i) =>
    [
      `示例${i + 1}:`,
      ex.context ? `上下文:\n${ex.context}` : '',
      `用户: ${ex.user}`,
      ex.activity ? `活动: ${ex.activity}` : '',
      `→ {"intent":"${ex.intent}"}`,
    ]
      .filter(Boolean)
      .join('\n'),
  ).join('\n\n');

  return [
    '你是聊天意图路由器。根据用户最新一条消息（结合简短上下文）判断应执行的操作。',
    '只输出 JSON，字段：',
    '- intent: 必填',
    '  - create_post: 发帖、模板发帖、补充人数城市后发布、确认发布、重新发帖',
    '  - near_events: 查最近/热门活动',
    '  - dj_info: 查 DJ/艺人风格、阵容按曲风筛选、介绍某位 DJ、或承接上文找类似风格艺人',
    '  - chitchat: 闲聊或无法判断',
    '',
    '多轮对话：',
    '- 若上文在讨论某位 DJ/曲风，用户说「类似风格」「近期演出」「代表作」等简短跟进 → dj_info',
    '- 不要把用户整句检索指令当成艺人名',
    '歧义说明（绑定活动时必看）：',
    '- 「N号」常与活动 catalog 日期对齐（如 06/13-14 的 13号 多指 6月13日场次，而非日历 13 号）',
    '- 「A区/B区」可能指看台票区；若活动含 06/13，「13号A」优先理解为 6月13日 或 13号A区 票区',
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
