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
  const clauses: Record<string, unknown>[] = [];
  const uid = userId?.trim();
  const name = authorName?.trim();

  if (uid) {
    clauses.push({ userId: uid });
  }
  if (name) {
    clauses.push({ authorName: name });
    const first = name.split(/\s+/)[0];
    if (first) {
      clauses.push({
        authorName: { $regex: `^${escapeRegex(first)}`, $options: 'i' },
      });
    }
  }

  if (clauses.length === 0) {
    return { _id: null };
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

  if (uid && record.userId === uid) return true;
  if (name && record.authorName && authorNameMatches(record.authorName, name)) {
    return true;
  }
  return false;
}

export function isAiShortcutTag(_input: string): boolean {
  return false;
}
