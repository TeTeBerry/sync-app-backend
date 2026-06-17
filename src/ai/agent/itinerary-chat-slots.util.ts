export function parseDjNamesFromUserText(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];

  const segments = raw
    .split(/[,，、/|和与及]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const names: string[] = [];
  const seen = new Set<string>();
  for (const segment of segments) {
    const cleaned = segment
      .replace(/^(我想看|想看|喜欢|选|加上|还有)/, '')
      .trim();
    if (!cleaned || cleaned.length > 40) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned);
  }
  return names;
}

export function resolveDjIdsFromNames(
  names: string[],
  lineup: Array<{ id: string; name: string }>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) continue;

    const exact = lineup.find(
      (dj) => dj.name.trim().toLowerCase() === normalized,
    );
    const partial = lineup.find((dj) => {
      const djName = dj.name.trim().toLowerCase();
      return djName.includes(normalized) || normalized.includes(djName);
    });
    const match = exact ?? partial;
    if (!match || seen.has(match.id)) continue;
    seen.add(match.id);
    ids.push(match.id);
  }

  return ids;
}

export function buildItineraryCollectPrompt(): string {
  return [
    '好的，我来帮你生成专属行程。',
    '',
    '请告诉我你想看的 DJ（可多选），例如：「Marshmello、Martin Garrix」',
    '也可以点下方「生成专属行程」进入选 DJ 页面。',
  ].join('\n');
}
