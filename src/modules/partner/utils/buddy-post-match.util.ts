import type { PostRecord } from '../interfaces/post.repository.interface';
import { inferPostContentTypes } from './post-content-type.util';

export type BuddyPostMatchSignals = {
  contentTypeKeys: string[];
  tags: string[];
  location?: string;
};

const CONTENT_TYPE_KEYS = new Set<string>([
  'team',
  'accommodation',
  'carpool',
  'ticket',
  'other',
]);

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/^#/, '');
}

function normalizeCity(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function mergeContentTypeKeys(
  contentTypes: string[] | undefined,
  tags: string[] | undefined,
  body?: string,
): string[] {
  const keys = new Set<string>();
  for (const type of contentTypes ?? []) {
    const key = type.trim().toLowerCase();
    if (CONTENT_TYPE_KEYS.has(key)) keys.add(key);
  }
  for (const type of inferPostContentTypes({ tags, body })) {
    keys.add(type);
  }
  return [...keys];
}

function collectMatchTags(
  tags: string[] | undefined,
  contentTypeKeys: string[],
): string[] {
  const contentLabels = new Set(
    contentTypeKeys.map((key) => normalizeTag(key)),
  );
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags ?? []) {
    const normalized = normalizeTag(raw);
    if (!normalized) continue;
    if (CONTENT_TYPE_KEYS.has(normalized)) continue;
    if (contentLabels.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function extractBuddyPostMatchSignalsFromRecord(
  post: PostRecord,
): BuddyPostMatchSignals {
  const contentTypeKeys = mergeContentTypeKeys(
    post.contentTypes,
    post.tags,
    post.body,
  );
  const location =
    post.departureCity?.trim() || post.location?.trim() || undefined;
  return {
    contentTypeKeys,
    tags: collectMatchTags(post.tags, contentTypeKeys),
    location,
  };
}

export function scoreBuddyPostMatch(
  target: BuddyPostMatchSignals,
  candidate: BuddyPostMatchSignals,
): number {
  let score = 0;

  const targetTypes = new Set(target.contentTypeKeys);
  for (const key of candidate.contentTypeKeys) {
    if (targetTypes.has(key)) score += 10;
  }

  const targetTags = new Set(target.tags.map(normalizeTag));
  for (const tag of candidate.tags) {
    if (targetTags.has(normalizeTag(tag))) score += 3;
  }

  const targetCity = normalizeCity(target.location);
  const candidateCity = normalizeCity(candidate.location);
  if (targetCity && candidateCity && targetCity === candidateCity) {
    score += 2;
  }

  return score;
}

function recordTimestamp(post: PostRecord): number {
  if (!post.createdAt) return 0;
  const value = new Date(post.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function pickBestMatchingPostRecord(
  targetPost: PostRecord,
  candidates: PostRecord[],
): PostRecord | null {
  if (!candidates.length) return null;

  const target = extractBuddyPostMatchSignalsFromRecord(targetPost);
  let best: PostRecord | null = null;
  let bestScore = -1;
  let bestTime = 0;

  for (const candidate of candidates) {
    const signals = extractBuddyPostMatchSignalsFromRecord(candidate);
    const score = scoreBuddyPostMatch(target, signals);
    const time = recordTimestamp(candidate);
    if (score > bestScore || (score === bestScore && time > bestTime)) {
      best = candidate;
      bestScore = score;
      bestTime = time;
    }
  }

  return best;
}
