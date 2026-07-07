/** Maps emoji characters to bundled Twemoji asset ids (filename without .png). */
const EMOJI_ASSET_OVERRIDES: Record<string, string> = {
  '✈️': '2708',
  '✈': '2708',
};

export function emojiToAssetId(emoji: string): string {
  const override = EMOJI_ASSET_OVERRIDES[emoji];
  if (override) {
    return override;
  }

  const codepoints: string[] = [];

  for (const char of Array.from(emoji)) {
    const cp = char.codePointAt(0);
    if (cp === undefined || cp === 0xfe0f) {
      continue;
    }
    codepoints.push(cp.toString(16));
  }

  return codepoints.join('-');
}
