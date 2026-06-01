const CN_INDEX: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
};

function parseIndexToken(raw: string, max: number): number | null {
  const token = raw.trim();
  if (new RegExp(`^[1-${max}]$`).test(token)) return Number(token);
  return CN_INDEX[token] ?? null;
}

/** 解析「第一个」「2」「第 3 条」等列表序号（1-based） */
export function parseListSelectionIndex(input: string, max = 8): number | null {
  const text = input.trim();
  if (!text) return null;

  const digitClass = `[1-${max}]`;
  const cnClass = '[一二三四五六七八]';
  const patterns = [
    new RegExp(`第\\s*(${cnClass}|${digitClass})\\s*[个条号]`),
    new RegExp(`加入\\s*第?\\s*(${cnClass}|${digitClass})`),
    new RegExp(`^(${digitClass})$`),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseIndexToken(match[1], max);
    }
  }

  return null;
}

export function isListSelectionInput(input: string, max = 8): boolean {
  return parseListSelectionIndex(input, max) != null;
}
