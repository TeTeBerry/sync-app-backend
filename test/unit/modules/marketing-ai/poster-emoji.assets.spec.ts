import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { emojiToAssetId } from '../../../../src/modules/marketing-ai/image-renderer/poster-emoji.assets';
import {
  clearPosterEmojiCache,
  resolvePosterEmojiSrc,
} from '../../../../src/modules/marketing-ai/image-renderer/poster-emoji.loader';

describe('poster emoji assets', () => {
  const repoEmojiDir = path.join(
    process.cwd(),
    'src/modules/marketing-ai/assets/emoji',
  );

  beforeEach(() => {
    clearPosterEmojiCache();
  });

  it('maps travel airplane emoji to bundled 2708 asset', () => {
    expect(emojiToAssetId('✈️')).toBe('2708');
    expect(emojiToAssetId('🏨')).toBe('1f3e8');
  });

  it('ships bundled airplane asset with real dimensions', () => {
    const filePath = path.join(repoEmojiDir, '2708.png');
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath).length).toBeGreaterThan(200);
  });

  it('resolves bundled emoji to inline data URL', () => {
    const src = resolvePosterEmojiSrc('✈️');
    expect(src.startsWith('data:image/png;base64,')).toBe(true);
    expect(src.length).toBeGreaterThan(500);
  });
});
