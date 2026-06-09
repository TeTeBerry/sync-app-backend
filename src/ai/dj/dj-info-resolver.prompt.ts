import type { ChatMessageDto } from '../../shared/chat';

export interface LlmDjInfoResolveResult {
  intent?: string;
  artistName?: string;
  referenceArtist?: string;
  styles?: string[];
  scope?: string;
}

export const DJ_INFO_RESOLVER_FEW_SHOTS: Array<{
  history: string;
  input: string;
  output: LlmDjInfoResolveResult;
}> = [
  {
    history:
      '[user] Marshmello 什么风格\n[assistant] Marshmello 以 Future Bass、Pop EDM 为主。',
    input: '帮我找类似风格的DJ',
    output: {
      intent: 'similar_artists',
      referenceArtist: 'Marshmello',
      styles: ['Future Bass', 'Pop EDM'],
      scope: 'catalog',
    },
  },
  {
    history:
      '[user] Martin Garrix 是什么风格\n[assistant] Martin Garrix · Netherlands\n🎧 风格：Big Room · Progressive House\n荷兰 DJ...',
    input: '找类似风格的 DJ',
    output: {
      intent: 'similar_artists',
      referenceArtist: 'Martin Garrix',
      styles: ['Big Room', 'Progressive House'],
      scope: 'catalog',
    },
  },
  {
    history:
      '[user] Marshmello\n[assistant] Marshmello 是 Future Bass 制作人。想了解代表作、近期演出，还是类似艺人？',
    input: '近期演出',
    output: {
      intent: 'artist_performances',
      artistName: 'Marshmello',
      scope: 'catalog',
    },
  },
  {
    history:
      '[user] Marshmello 什么风格\n[assistant] Marshmello 以 Future Bass、Pop EDM 为主。',
    input: 'Marshmello 代表作有哪些',
    output: {
      intent: 'artist_discography',
      artistName: 'Marshmello',
      scope: 'catalog',
    },
  },
  {
    history:
      '[user] Marshmello\n[assistant] Marshmello 是 Future Bass 制作人。想了解代表作、近期演出，还是类似艺人？',
    input: '代表作有哪些',
    output: {
      intent: 'artist_discography',
      artistName: 'Marshmello',
      scope: 'catalog',
    },
  },
  {
    history: '',
    input: 'Illenium 是什么风格',
    output: {
      intent: 'artist_profile',
      artistName: 'Illenium',
      scope: 'catalog',
    },
  },
  {
    history: '[user] 这场有哪些 Techno',
    input: '这场有哪些 Techno DJ',
    output: {
      intent: 'lineup_by_style',
      styles: ['Techno'],
      scope: 'lineup',
    },
  },
];

export function buildDjInfoResolverSystemPrompt(): string {
  const fewShotBlock = DJ_INFO_RESOLVER_FEW_SHOTS.map((shot) =>
    [
      '---',
      `历史:\n${shot.history || '(无)'}`,
      `用户最新消息: ${shot.input}`,
      `输出: ${JSON.stringify(shot.output)}`,
    ].join('\n'),
  ).join('\n');

  return [
    '你是 DJ/艺人问答的意图解析器。根据多轮对话理解用户真正想查什么，输出 JSON。',
    '只输出 JSON，字段：',
    '- intent: artist_profile | artist_performances | artist_discography | similar_artists | by_style | lineup_by_style | lineup_overview',
    '- artistName: 查某位艺人介绍/风格/演出/代表作时使用（英文艺名）',
    '- referenceArtist: 找风格相近艺人时，从上文提取参考艺人（不要填用户整句指令）',
    '- styles: 曲风数组，如 ["Future Bass","Techno"]',
    '- scope: catalog（艺人库）| lineup（当前活动阵容）| auto',
    '',
    '规则：',
    '- 用户说「近期演出」「演出安排」「哪场演出」等简短跟进时，结合上文确定 artistName',
    '- 用户说「代表作」「有哪些歌」「热门曲目」等时 → artist_discography，结合上文确定 artistName',
    '- 用户说「类似风格」「相近的」「像他这种」等指代时，必须结合上文**最近**讨论的艺人确定 referenceArtist 和 styles（不要沿用上一条会话里更早的艺人）',
    '- 不要把用户整句中文指令（如「帮我找类似风格的DJ」）当作 artistName',
    '- similar_artists 默认 scope=catalog，除非用户明确问「这场阵容」',
    '- lineup_* 用于用户明确问当前活动/这场阵容',
    '',
    fewShotBlock,
  ].join('\n');
}

export function buildDjInfoResolverUserPrompt(params: {
  messages: ChatMessageDto[];
  input: string;
  activityLegacyId?: number;
  toolArgs?: Record<string, unknown>;
}): string {
  const history = params.messages
    .slice(-8)
    .map((message) => `[${message.role}] ${message.content.trim()}`)
    .join('\n');

  const activityBlock =
    params.activityLegacyId != null && !Number.isNaN(params.activityLegacyId)
      ? `已绑定活动 legacyId=${params.activityLegacyId}`
      : '未绑定具体活动';

  const toolBlock =
    params.toolArgs && Object.keys(params.toolArgs).length
      ? JSON.stringify(params.toolArgs)
      : '(无)';

  return [
    '对话历史:',
    history || '(无)',
    '',
    '用户最新消息:',
    params.input.trim(),
    '',
    activityBlock,
    '',
    'Agent 工具参数（仅供参考，可能错误，以对话为准）:',
    toolBlock,
  ].join('\n');
}
