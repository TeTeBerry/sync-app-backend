import type { ConversationContext } from './conversation-context.parser';

export type BuddyCopyStyle = 'literary' | 'minimal' | 'direct';

export interface BuddyCopyVariant {
  style: BuddyCopyStyle;
  label: string;
  body: string;
}

export const BUDDY_COPY_STYLE_LABELS: Record<BuddyCopyStyle, string> = {
  literary: '文艺',
  minimal: '简约',
  direct: '直白',
};

const STYLE_ALIASES: Record<string, BuddyCopyStyle> = {
  文艺: 'literary',
  简约: 'minimal',
  直白: 'direct',
  literary: 'literary',
  minimal: 'minimal',
  direct: 'direct',
};

const COPY_STYLE_REQUEST_RE =
  /^(?:#)?文案[-\s]?(.+?)(?:#)?$|^(?:生成|换)(?:一)?(?:个|条)?(.+?)(?:风格)?文案$/;

export function detectBuddyCopyStyleRequest(
  input: string,
): BuddyCopyStyle | 'all' | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^(生成文案|三种文案|文案推荐|一键文案)$/.test(trimmed)) {
    return 'all';
  }

  const match = trimmed.match(COPY_STYLE_REQUEST_RE);
  if (!match) return null;

  const rawStyle = (match[1] ?? match[2] ?? '').trim();
  const style = STYLE_ALIASES[rawStyle];
  return style ?? 'all';
}

function buildDetailClause(ctx: ConversationContext): string {
  const parts: string[] = [];
  if (ctx.eventDate) parts.push(`日期 ${ctx.eventDate}`);
  if (ctx.peopleCount) parts.push(`${ctx.peopleCount} 人同行`);
  if (ctx.city) parts.push(`从 ${ctx.city} 出发`);
  if (ctx.genderPreference) parts.push(ctx.genderPreference);
  return parts.join('，');
}

export function buildBuddyCopyVariant(
  style: BuddyCopyStyle,
  baseDraft: string,
  activityName?: string,
  ctx?: ConversationContext,
): BuddyCopyVariant {
  const activity = activityName ?? ctx?.activityKeyword ?? '活动';
  const detail = buildDetailClause(ctx ?? {});
  const core = baseDraft.trim() || `找 ${activity} 同行`;

  let body: string;
  switch (style) {
    case 'literary':
      body = detail
        ? `${core} ✨\n${detail}，期待遇见同频的你，一起把 ${activity} 变成难忘回忆。`
        : `${core} ✨\n在 ${activity} 的节拍里，等一位同路人，把旅程写进回忆。`;
      break;
    case 'minimal':
      body = detail
        ? `${activity} · ${detail}\n${core}`
        : `${activity}\n${core}`;
      break;
    case 'direct':
    default:
      body = detail
        ? `找 ${activity} 同行：${detail}。${core.replace(/^找\s*[^：]+同行[：:]?\s*/i, '')}`
        : `找 ${activity} 同行，${core}`;
      break;
  }

  return {
    style,
    label: BUDDY_COPY_STYLE_LABELS[style],
    body: body.trim(),
  };
}

export function buildBuddyCopyVariants(
  baseDraft: string,
  activityName?: string,
  ctx?: ConversationContext,
): BuddyCopyVariant[] {
  return (['literary', 'minimal', 'direct'] as BuddyCopyStyle[]).map(style =>
    buildBuddyCopyVariant(style, baseDraft, activityName, ctx),
  );
}
