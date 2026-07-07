import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { emojiToAssetId } from './poster-emoji.assets';

const dataUrlCache = new Map<string, string>();

function resolveEmojiDir(): string {
  const candidates = [
    path.join(__dirname, '../assets/emoji'),
    path.join(process.cwd(), 'src/modules/marketing-ai/assets/emoji'),
    path.join(process.cwd(), 'dist/src/modules/marketing-ai/assets/emoji'),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, '2708.png'))) {
      return candidate;
    }
  }

  return candidates[0];
}

function toDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/** Resolve emoji to an inline PNG data URL from bundled assets (no network). */
export function resolvePosterEmojiSrc(emoji: string): string {
  const assetId = emojiToAssetId(emoji);
  if (!assetId) {
    return '';
  }

  const cached = dataUrlCache.get(assetId);
  if (cached) {
    return cached;
  }

  const filePath = path.join(resolveEmojiDir(), `${assetId}.png`);
  if (!existsSync(filePath)) {
    return '';
  }

  const dataUrl = toDataUrl(readFileSync(filePath));
  dataUrlCache.set(assetId, dataUrl);
  return dataUrl;
}

export function clearPosterEmojiCache(): void {
  dataUrlCache.clear();
}

export function emojiImage(
  emoji: string,
  size: number,
  margin: Record<string, number> = {},
): {
  type: 'img';
  props: {
    src: string;
    width: number;
    height: number;
    style: Record<string, number | string>;
  };
} {
  return {
    type: 'img',
    props: {
      src: resolvePosterEmojiSrc(emoji),
      width: size,
      height: size,
      style: {
        display: 'block',
        flexShrink: 0,
        ...margin,
      },
    },
  };
}
