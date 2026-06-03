export type LiveInfoUpdateSortInput = {
  createdAt?: Date | string;
  likedByUserIds?: string[];
  remark?: string;
};

export function liveInfoUpdateSortScore(doc: LiveInfoUpdateSortInput): number {
  const createdAtMs =
    doc.createdAt instanceof Date
      ? doc.createdAt.getTime()
      : doc.createdAt
        ? new Date(doc.createdAt).getTime()
        : 0;
  const likes = doc.likedByUserIds?.length ?? 0;
  const hasRemark = Boolean(doc.remark?.trim());

  return createdAtMs / 1e6 + likes * 2 + (hasRemark ? 0.5 : 0);
}

export function sortLiveInfoUpdatesByScore<T extends LiveInfoUpdateSortInput>(
  updates: T[],
): T[] {
  return [...updates].sort(
    (left, right) =>
      liveInfoUpdateSortScore(right) - liveInfoUpdateSortScore(left),
  );
}
