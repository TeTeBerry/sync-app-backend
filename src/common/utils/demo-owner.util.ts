/** AI shortcut tags (reserved; currently unused). */
export const AI_SHORTCUT_TAGS = [] as const;

export const AI_SHORTCUT_TAG_ALIASES: Record<string, string> = {};

export function normalizeAiShortcutInput(input: string): string {
  return input.trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function authorNameMatches(stored: string, client?: string): boolean {
  const author = stored.trim();
  const name = client?.trim();
  if (!name || !author) return false;
  if (author === name) return true;
  const clientFirst = name.split(/\s+/)[0] ?? '';
  const authorFirst = author.split(/\s+/)[0] ?? '';
  return (
    clientFirst === authorFirst ||
    name.startsWith(`${authorFirst} `) ||
    author.startsWith(`${clientFirst} `)
  );
}

/** Mongo owner filter from JWT actor fields. */
export function buildOwnerMongoFilter(
  userId?: string,
  authorName?: string,
): Record<string, unknown> {
  const uid = userId?.trim();
  if (uid) {
    // Authenticated users are keyed by userId only — do not OR on authorName
    // (e.g. default WeChat nicknames would leak cross-user registrations).
    return { userId: uid };
  }

  const name = authorName?.trim();
  if (!name) {
    return { _id: null };
  }

  const clauses: Record<string, unknown>[] = [{ authorName: name }];
  const first = name.split(/\s+/)[0];
  if (first && first !== name) {
    clauses.push({
      authorName: { $regex: `^${escapeRegex(first)}`, $options: 'i' },
    });
  }
  return { $or: clauses };
}

/** Whether a resource belongs to the request actor. */
export function isResourceOwnedByClient(
  record: { userId?: string; authorName?: string },
  userId?: string,
  authorName?: string,
): boolean {
  const uid = userId?.trim();
  const name = authorName?.trim();
  const recordUid = record.userId?.trim();

  if (uid) {
    if (recordUid) {
      return recordUid === uid;
    }
    if (
      name &&
      record.authorName &&
      authorNameMatches(record.authorName, name)
    ) {
      return true;
    }
    return false;
  }

  if (name && record.authorName && authorNameMatches(record.authorName, name)) {
    return true;
  }
  return false;
}

export function isAiShortcutTag(_input: string): boolean {
  return false;
}
