import { extractDjStyles } from './dj-info-query.util';
import type {
  DjInfoStructuredIntent,
  DjInfoStructuredQuery,
  DjInfoStructuredScope,
} from './dj-info-structured.types';

const STRUCTURED_INTENTS = new Set<DjInfoStructuredIntent>([
  'artist_profile',
  'artist_performances',
  'artist_discography',
  'similar_artists',
  'by_style',
  'lineup_by_style',
  'lineup_overview',
]);

const STRUCTURED_SCOPES = new Set<DjInfoStructuredScope>([
  'catalog',
  'lineup',
  'auto',
]);

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStyles(styles: string[]): string[] {
  const normalized = styles.flatMap((style) => extractDjStyles(style));
  const extras = styles.filter((style) => style.trim().length >= 3);
  return [...new Set([...normalized, ...extras])];
}

function inferScope(
  intent: DjInfoStructuredIntent,
  activityLegacyId?: number,
  explicitScope?: DjInfoStructuredScope,
): DjInfoStructuredScope {
  if (explicitScope && STRUCTURED_SCOPES.has(explicitScope)) {
    return explicitScope;
  }
  if (
    intent === 'similar_artists' ||
    intent === 'by_style' ||
    intent === 'artist_profile' ||
    intent === 'artist_performances' ||
    intent === 'artist_discography'
  ) {
    return 'catalog';
  }
  if (
    activityLegacyId != null &&
    !Number.isNaN(activityLegacyId) &&
    (intent === 'lineup_by_style' || intent === 'lineup_overview')
  ) {
    return 'lineup';
  }
  return 'catalog';
}

/** 将 LLM / 工具 JSON 规范化为可执行的查询（不做正则意图推断） */
export function normalizeStructuredDjQuery(
  raw: Record<string, unknown>,
  activityLegacyId?: number,
): DjInfoStructuredQuery | null {
  const intentRaw = asTrimmedString(raw.intent)?.toLowerCase();
  if (
    !intentRaw ||
    !STRUCTURED_INTENTS.has(intentRaw as DjInfoStructuredIntent)
  ) {
    return null;
  }

  const intent = intentRaw as DjInfoStructuredIntent;
  const scopeRaw = asTrimmedString(raw.scope)?.toLowerCase() as
    | DjInfoStructuredScope
    | undefined;

  return {
    intent,
    artistName: asTrimmedString(raw.artistName),
    referenceArtist: asTrimmedString(raw.referenceArtist),
    styles: normalizeStyles(asStringArray(raw.styles)),
    scope: inferScope(intent, activityLegacyId, scopeRaw),
  };
}
