#!/usr/bin/env node
/**
 * Download bundled poster fonts (serif editorial + emoji) for Satori rendering.
 * Satori requires TTF — sources via google-webfonts-helper (gwfh.mranftl.com).
 */
import { execSync } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const fontDir = path.join(
  root,
  'src/modules/marketing-ai/assets/fonts',
);

const FONT_ZIPS = [
  {
    url: 'https://gwfh.mranftl.com/api/fonts/playfair-display?download=zip&subsets=latin&variants=700,regular',
    files: [
      ['playfair-display-v40-latin-700.ttf', 'PlayfairDisplay-Bold.ttf'],
      ['playfair-display-v40-latin-regular.ttf', 'PlayfairDisplay-Regular.ttf'],
    ],
  },
  {
    url: 'https://gwfh.mranftl.com/api/fonts/libre-baskerville?download=zip&subsets=latin&variants=700,regular',
    files: [
      ['libre-baskerville-v24-latin-regular.ttf', 'LibreBaskerville-Regular.ttf'],
      ['libre-baskerville-v24-latin-700.ttf', 'LibreBaskerville-Bold.ttf'],
    ],
  },
];

async function downloadZip(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(dest, buffer),
  );
}

async function main() {
  await mkdir(fontDir, { recursive: true });
  const tmpDir = path.join(root, '.tmp-poster-fonts');
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  for (const pack of FONT_ZIPS) {
    const zipPath = path.join(tmpDir, `${pack.files[0][1]}.zip`);
    await downloadZip(pack.url, zipPath);
    execSync(`unzip -qo "${zipPath}" -d "${tmpDir}"`);

    for (const [sourceName, targetName] of pack.files) {
      const sourcePath = path.join(tmpDir, sourceName);
      const targetPath = path.join(fontDir, targetName);
      await rename(sourcePath, targetPath);
      console.log(`✓ ${targetName}`);
    }
  }

  await rm(tmpDir, { recursive: true, force: true });
  console.log(`Poster fonts saved to ${fontDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
