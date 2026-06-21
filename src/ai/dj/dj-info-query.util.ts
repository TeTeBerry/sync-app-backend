import type { ChatMessageDto } from '../../shared/chat';
import type { DjInfoStructuredQuery } from './dj-info-structured.types';
import { resolveHomeFestivalShortcutCode } from '../utils/festival-shortcut.util';

export type DjInfoQueryKind =
  | 'artist_profile'
  | 'lineup_by_style'
  | 'catalog_by_style'
  | 'lineup_overview';

export type DjInfoQuery = {
  kind: DjInfoQueryKind;
  artistName?: string;
  styles: string[];
  /** 找类似艺人时排除参考艺人 */
  referenceArtist?: string;
};

export type DjChatContext = {
  referenceArtist?: string;
  styles: string[];
};

const STYLE_ALIASES: Record<string, string> = {
  dnb: 'Drum & Bass',
  'drum and bass': 'Drum & Bass',
  'drum & bass': 'Drum & Bass',
  bigroom: 'Big Room',
  'big room': 'Big Room',
  hardstyle: 'Hardstyle',
  'bass house': 'Bass House',
  'future bass': 'Future Bass',
  techno: 'Techno',
  house: 'House',
  trance: 'Trance',
  dubstep: 'Dubstep',
  trap: 'Trap',
};

const STYLE_PATTERN =
  /\b(techno|house|trance|dubstep|hardstyle|trap|dnb|drum\s*&?\s*bass|big\s*room|bass\s*house|future\s*bass)\b/gi;

/** 规则快路径 + agent-first：DJ/艺人/曲风只读问句 */
export function isDjInfoIntent(
  input: string,
  options?: { activityLegacyId?: number },
): boolean {
  const text = input.trim();
  if (!text) return false;

  const activityLegacyId = options?.activityLegacyId;
  const unbound = activityLegacyId == null || Number.isNaN(activityLegacyId);
  if (unbound && resolveHomeFestivalShortcutCode(text)) {
    return false;
  }

  if (
    /什么风格|什么曲风|风格是什么|曲风是什么|玩什么风格|主要风格|音乐风格/.test(
      text,
    )
  ) {
    return true;
  }

  if (/阵容/.test(text) && /(dj|艺人|阵容|谁|style|风格)/i.test(text)) {
    return true;
  }

  if (/(有哪些|列出|推荐|找几个).*(dj|艺人)/i.test(text)) {
    return true;
  }

  if (isSimilarStyleFollowUp(text)) {
    return true;
  }

  if (
    /帮我找.*(dj|艺人)/i.test(text) &&
    /(类似|相近|相同|这种|这个|同款)/.test(text)
  ) {
    return true;
  }

  if (STYLE_PATTERN.test(text) && /(dj|艺人|阵容|推荐|有哪些)/i.test(text)) {
    return true;
  }

  if (/(是谁|介绍一下|介绍下)/i.test(text) && text.length <= 48) {
    return true;
  }

  return false;
}

export function extractDjStyles(input: string): string[] {
  const matches = input.match(STYLE_PATTERN) ?? [];
  const styles = matches.map((match) => normalizeStyleToken(match));
  return [...new Set(styles)];
}

function normalizeStyleToken(token: string): string {
  const key = token.trim().toLowerCase().replace(/\s+/g, ' ');
  return STYLE_ALIASES[key] ?? token.trim().replace(/\s+/g, ' ');
}

export function parseDjInfoQuery(input: string): DjInfoQuery {
  const trimmed = input.trim();
  const styles = extractDjStyles(trimmed);

  const artistProfileMatch = trimmed.match(
    /^(.{2,80}?)(?:是什么风格|什么风格|什么曲风|风格是什么|曲风是什么|是谁|介绍一下|介绍下)[？?。!！]*$/i,
  );
  if (artistProfileMatch?.[1]) {
    return {
      kind: 'artist_profile',
      artistName: artistProfileMatch[1].trim(),
      styles,
    };
  }

  if (/阵容/.test(trimmed)) {
    if (styles.length) {
      return { kind: 'lineup_by_style', styles };
    }
    return { kind: 'lineup_overview', styles };
  }

  if (styles.length) {
    return { kind: 'catalog_by_style', styles };
  }

  const compact = trimmed.replace(/[？?。!！]/g, '').trim();
  if (
    compact.length >= 2 &&
    compact.length <= 48 &&
    isPlausibleArtistName(compact)
  ) {
    return {
      kind: 'artist_profile',
      artistName: compact,
      styles,
    };
  }

  return { kind: 'lineup_overview', styles };
}

export function isSimilarStyleFollowUp(input: string): boolean {
  const text = input.trim();
  if (!text) return false;
  return (
    /(类似|相近|相同|这种|这个|同款).*(风格|曲风).*(dj|艺人)/i.test(text) ||
    /(类似|相近|相同|这种|这个|同款).*(dj|艺人)/i.test(text) ||
    /帮我找.*(类似|相近).*(dj|艺人)/i.test(text) ||
    /推荐.*(类似|相近).*(dj|艺人)/i.test(text)
  );
}

/** 用户整句是检索指令，不是艺名 */
export function looksLikeDjSearchCommand(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isSimilarStyleFollowUp(trimmed)) return true;
  if (/^(帮我|请帮我|能不能|可以|麻烦)/.test(trimmed)) return true;
  if (
    /(有哪些|列出|推荐|找几个|有没有人)/.test(trimmed) &&
    /(dj|艺人|风格|曲风|阵容)/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export function isPlausibleArtistName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 48) {
    return false;
  }
  if (looksLikeDjSearchCommand(trimmed)) {
    return false;
  }
  if (
    /[\u4e00-\u9fff]/.test(trimmed) &&
    /(帮我|类似|风格|曲风|艺人|阵容|找|推荐|哪些|有没有)/.test(trimmed)
  ) {
    return false;
  }
  return true;
}

const ARTIST_IN_STYLE_QUESTION =
  /([A-Za-z][\w\s.&'/-]{0,40}?)\s*(?:是什么风格|什么风格|什么曲风|风格是什么|曲风是什么)/i;

function extractStylesFromProfileLine(content: string): string[] {
  const match = content.match(/🎧\s*风格[：:]\s*([^\n]+)/);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(/[·／/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function collectStylesFromContent(content: string): string[] {
  const found = new Set<string>();
  for (const style of extractStylesFromText(content)) {
    found.add(style);
  }
  for (const style of extractStylesFromProfileLine(content)) {
    found.add(style);
  }
  for (const style of extractDjStyles(content)) {
    found.add(style);
  }
  return [...found];
}

function extractArtistFromUserMessage(content: string): string | undefined {
  const artistMatch = content.match(ARTIST_IN_STYLE_QUESTION);
  if (artistMatch?.[1]) {
    return artistMatch[1].trim();
  }

  const chipClick = content.match(
    /^([A-Za-z][\w\s.&'/-]{1,40}[A-Za-z0-9.])\s+(?:近期演出|是什么风格|代表作)/,
  );
  if (chipClick?.[1]) {
    return chipClick[1].trim();
  }

  const compact = content.trim();
  if (isPlausibleArtistName(compact)) {
    return compact;
  }

  return undefined;
}

function extractArtistFromAssistantMessage(
  content: string,
): string | undefined {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  if (/🎧\s*风格/.test(content)) {
    const profileMatch = firstLine.match(
      /^([A-Za-z][A-Za-z0-9\s.&'/-]{1,40}[A-Za-z0-9.])\s*(?:·|$)/,
    );
    if (profileMatch?.[1]) {
      return profileMatch[1].trim();
    }
  }

  const discography = content.match(
    /🎵\s*([A-Za-z][\w\s.&'/-]{1,40}?)\s+代表作/,
  );
  if (discography?.[1]) {
    return discography[1].trim();
  }

  const similar = content.match(/与\s+([A-Za-z][\w\s.&'/-]{1,40}?)\s+风格相近/);
  if (similar?.[1]) {
    return similar[1].trim();
  }

  const performances = content.match(
    /🎤\s*([A-Za-z][\w\s.&'/-]{1,40}?)\s+近期演出/,
  );
  if (performances?.[1]) {
    return performances[1].trim();
  }

  const namedInAssistant = content.match(
    /\b([A-Z][A-Za-z0-9.&'/-]{2,30})\b.*(?:风格|曲风|制作人|艺人)/,
  );
  if (namedInAssistant?.[1]) {
    return namedInAssistant[1].trim();
  }

  return undefined;
}

/** 从最近对话提取参考艺人（新消息优先，避免串到更早的 Marshmello 等上下文） */
export function resolveDjChatContext(
  messages: ChatMessageDto[],
): DjChatContext {
  let referenceArtist: string | undefined;
  let styles: string[] = [];

  for (const message of [...messages].slice(-12).reverse()) {
    const content = message.content?.trim() ?? '';
    if (!content) continue;

    const artist =
      message.role === 'user'
        ? extractArtistFromUserMessage(content)
        : message.role === 'assistant'
          ? extractArtistFromAssistantMessage(content)
          : undefined;

    if (artist) {
      referenceArtist ??= artist;
      const messageStyles = collectStylesFromContent(content);
      if (messageStyles.length) {
        styles = messageStyles;
      }
    }
  }

  if (referenceArtist && !styles.length) {
    for (const message of [...messages].slice(-12).reverse()) {
      const content = message.content?.trim() ?? '';
      if (!content) continue;
      const messageStyles = collectStylesFromContent(content);
      if (messageStyles.length) {
        styles = messageStyles;
        break;
      }
    }
  }

  return {
    referenceArtist,
    styles,
  };
}

/** 用对话锚点校正 LLM/Agent 解析结果，防止 few-shot 偏置或历史串台 */
export function applyDjConversationAnchor(
  query: DjInfoStructuredQuery,
  messages: ChatMessageDto[],
  input: string,
): DjInfoStructuredQuery {
  const trimmed = input.trim();
  const ctx = resolveDjChatContext(messages);
  const anchor = ctx.referenceArtist?.trim();
  if (!anchor) {
    return query;
  }

  if (query.intent === 'similar_artists' || isSimilarStyleFollowUp(trimmed)) {
    return {
      ...query,
      intent: 'similar_artists',
      referenceArtist: anchor,
      artistName: undefined,
      styles: query.styles.length > 0 ? query.styles : ctx.styles,
    };
  }

  const isShortFollowUp =
    trimmed.length <= 32 &&
    /近期演出|演出安排|代表作|是什么风格|什么风格/.test(trimmed);

  if (
    isShortFollowUp &&
    (query.intent === 'artist_performances' ||
      query.intent === 'artist_discography' ||
      query.intent === 'artist_profile')
  ) {
    return {
      ...query,
      artistName: anchor,
    };
  }

  return query;
}

function extractStylesFromText(text: string): string[] {
  const styles: string[] = [];
  const boldChunks = text.match(/\*\*([^*]+)\*\*/g) ?? [];
  for (const chunk of boldChunks) {
    const inner = chunk.replace(/\*\*/g, '').trim();
    for (const part of inner.split(/[/／·|]/)) {
      const trimmed = part.trim();
      if (trimmed.length >= 3 && trimmed.length <= 40) {
        styles.push(trimmed);
      }
    }
  }
  return styles;
}

export function enrichDjUserQuery(
  messages: ChatMessageDto[],
  input: string,
): string {
  const trimmed = input.trim();
  if (!isSimilarStyleFollowUp(trimmed)) {
    return trimmed;
  }

  const ctx = resolveDjChatContext(messages);
  const parts = [trimmed];
  if (ctx.referenceArtist) {
    parts.push(`参考艺人：${ctx.referenceArtist}`);
  }
  if (ctx.styles.length) {
    parts.push(`参考曲风：${ctx.styles.join('、')}`);
  }
  return parts.join('；');
}

export function parseDjInfoQueryWithContext(
  input: string,
  messages: ChatMessageDto[] = [],
): DjInfoQuery {
  const trimmed = input.trim();

  if (isSimilarStyleFollowUp(trimmed)) {
    const ctx = resolveDjChatContext(messages);
    if (ctx.styles.length) {
      return {
        kind: 'catalog_by_style',
        styles: ctx.styles,
        referenceArtist: ctx.referenceArtist,
      };
    }
    if (ctx.referenceArtist) {
      return {
        kind: 'catalog_by_style',
        styles: ctx.styles,
        referenceArtist: ctx.referenceArtist,
      };
    }
  }

  const parsed = parseDjInfoQuery(trimmed);
  if (
    parsed.kind === 'artist_profile' &&
    parsed.artistName &&
    !isPlausibleArtistName(parsed.artistName)
  ) {
    return { kind: 'lineup_overview', styles: [] };
  }
  return parsed;
}
