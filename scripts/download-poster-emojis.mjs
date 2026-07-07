#!/usr/bin/env node
/**
 * Download bundled Twemoji PNGs for offline poster rendering (no CDN at runtime).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TWEMOJI_BASE =
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

const EMOJI_ASSET_IDS = [
  '2708',
  '1f3e8',
  '1f4b0',
  '1f4cd',
  '1f4c5',
  '1f30e',
  '1f1e7-1f1ea',
  '1f1f9-1f1ed',
  '1f1ef-1f1f5',
  '1f1f0-1f1f7',
  '1f1f3-1f1f1',
  '1f1fa-1f1f8',
  '1f1ec-1f1e7',
  '1f1e6-1f1ea',
  '1f1f8-1f1f4',
  '1f1ed-1f1f0',
  '1f1e8-1f1f3',
  '1f1ed-1f1f7',
  '1f1f8-1f1e6',
  '1f1f9-1f1f7',
  '1f1f5-1f1ed',
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emojiDir = path.join(
  root,
  'src/modules/marketing-ai/assets/emoji',
);

async function downloadAsset(assetId) {
  const url = `${TWEMOJI_BASE}/${assetId}.png`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download ${assetId}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const target = path.join(emojiDir, `${assetId}.png`);
  await writeFile(target, buffer);
  console.log(`✓ ${assetId}.png`);
}

async function main() {
  await mkdir(emojiDir, { recursive: true });

  for (const assetId of EMOJI_ASSET_IDS) {
    await downloadAsset(assetId);
  }

  console.log(`Poster emoji assets saved to ${emojiDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
