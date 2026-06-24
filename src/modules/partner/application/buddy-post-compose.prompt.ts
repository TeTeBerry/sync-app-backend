import type { BuddyPostComposeHints } from '@sync/partner-contracts';

export const BUDDY_POST_AI_COMPOSE_DISCLAIMER = 'AI 生成，仅供参考';

export interface LlmBuddyPostComposeResult {
  candidates: Array<{
    text: string;
    style?: 'code' | 'slogan';
  }>;
}

export type BuddyPostComposeContext = {
  activityTitle: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  headcount: string;
  hints?: BuddyPostComposeHints;
  regenerate?: boolean;
};

export const BUDDY_POST_COMPOSE_FEW_SHOTS: Array<{
  input: BuddyPostComposeContext;
  output: LlmBuddyPostComposeResult;
}> = [
  {
    input: {
      activityTitle: 'EDC Korea',
      dateStart: '2026-05-15',
      dateEnd: '2026-05-17',
      location: '上海',
      headcount: '2',
      hints: {
        personalityType: 'frontline',
        favorGenres: ['Techno', 'Hard Techno'],
      },
    },
    output: {
      candidates: [
        { text: '暗号：主舞台见，Techno 不睡', style: 'code' },
        { text: '口号：前排蹦到腿软小队', style: 'slogan' },
        { text: '接头语：上海出发，缺你一位', style: 'code' },
      ],
    },
  },
  {
    input: {
      activityTitle: 'Ultra Europe',
      dateStart: '2026-07-10',
      dateEnd: '2026-07-12',
      location: '北京',
      headcount: '3',
      hints: {
        setPicks: ['Martin Garrix', 'Hardwell'],
        prefillSummary: '必看 Set：Martin Garrix · Hardwell',
      },
    },
    output: {
      candidates: [
        { text: '暗号：MG 开场前集合', style: 'code' },
        { text: '口号：必看 Set 小队集结', style: 'slogan' },
        { text: '接头语：北京出发，还差一位', style: 'code' },
      ],
    },
  },
];

export function buildBuddyPostComposeSystemPrompt(): string {
  const fewShotBlock = BUDDY_POST_COMPOSE_FEW_SHOTS.map(
    (ex, i) =>
      `示例${i + 1}:\n输入: ${JSON.stringify(ex.input)}\n→ ${JSON.stringify(ex.output)}`,
  ).join('\n\n');

  return [
    '你是电音节公开招募帖的创意文案助手。根据活动信息与用户偏好，生成 3 条简短备注候选。',
    '',
    '候选类型：',
    '- code：接头暗号、碰头口令（轻松有趣，10～24 字）',
    '- slogan：小队口号、slogan（简短有力，8～20 字）',
    '',
    '硬性规则：',
    '- 必须输出恰好 3 条，互不重复',
    '- 只写备注正文，不要重复日期/城市/人数等结构化字段',
    '- 禁止手机号、微信号、QQ、邮箱、链接、票价、代购、加微信',
    '- 禁止匹配度、缘分队友、配对、平台担保组满等表述',
    '- 语气友好、适合公开招募场景，不要低俗或攻击性',
    '',
    fewShotBlock,
    '',
    '只输出 JSON：{ "candidates": [{ "text": "...", "style": "code"|"slogan" }] }',
  ].join('\n');
}

export function buildBuddyPostComposeUserPrompt(
  context: BuddyPostComposeContext,
): string {
  const lines = [
    `活动：${context.activityTitle}`,
    `日期：${context.dateStart} 至 ${context.dateEnd}`,
    `出发地：${context.location}`,
    `人数：${context.headcount}`,
  ];

  const hints = context.hints;
  if (hints?.personalityType) {
    lines.push(`人格类型：${hints.personalityType}`);
  }
  if (hints?.favorGenres?.length) {
    lines.push(`偏好曲风：${hints.favorGenres.join('、')}`);
  }
  if (hints?.setPicks?.length) {
    lines.push(`必看 Set：${hints.setPicks.join('、')}`);
  }
  if (hints?.prefillSummary?.trim()) {
    lines.push(`预填摘要：${hints.prefillSummary.trim()}`);
  }
  if (context.regenerate) {
    lines.push('请换一批全新表述，与常见模板明显不同。');
  }

  return lines.join('\n');
}

export function buildRuleBasedComposeCandidates(
  context: BuddyPostComposeContext,
): LlmBuddyPostComposeResult['candidates'] {
  const city = context.location.trim() || '现场';
  const genre = context.hints?.favorGenres?.[0]?.trim();
  const setName = context.hints?.setPicks?.[0]?.trim();
  const personality = context.hints?.personalityType?.trim();

  const base = [
    {
      text: `暗号：${city}出发，主舞台见`,
      style: 'code' as const,
    },
    {
      text: genre ? `口号：${genre}小队集结` : '口号：一起蹦到日出',
      style: 'slogan' as const,
    },
    {
      text: setName
        ? `接头语：${setName} 开场前集合`
        : personality
          ? `接头语：${personality}型 Raver 碰头`
          : `接头语：${city}小队缺你一位`,
      style: 'code' as const,
    },
  ];

  if (context.regenerate) {
    return [
      { text: `暗号：${city}小分队，不见不散`, style: 'code' },
      { text: '口号：节奏对上就组队', style: 'slogan' },
      {
        text: genre ? `接头语：偏爱 ${genre} 的来` : '接头语：现场碰头暗号见',
        style: 'code',
      },
    ];
  }

  return base;
}
