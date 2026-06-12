/** Normalize Amap POI `biz_ext.cost` (string | number | array) to yuan per person. */
export function parseAmapCost(
  cost?: string | number | string[],
): number | undefined {
  if (cost == null) return undefined;
  if (typeof cost === 'number') {
    if (!Number.isFinite(cost) || cost <= 0) return undefined;
    return cost;
  }
  if (Array.isArray(cost)) {
    for (const item of cost) {
      const parsed = parseAmapCost(item);
      if (parsed != null) return parsed;
    }
    return undefined;
  }
  if (typeof cost !== 'string') return undefined;
  const trimmed = cost.trim();
  if (!trimmed || trimmed === '[]') return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
}
