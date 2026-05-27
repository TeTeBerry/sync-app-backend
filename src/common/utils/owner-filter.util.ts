export interface OwnerFilter {
  userId?: string;
  authorName?: string;
}

export function resolveOwnerFilter(
  userId?: string,
  authorName?: string,
): OwnerFilter {
  return {
    userId: userId?.trim() || undefined,
    authorName: authorName?.trim() || undefined,
  };
}
