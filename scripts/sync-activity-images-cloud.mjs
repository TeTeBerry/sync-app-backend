#!/usr/bin/env node
/**
 * Upload activity hero images to CloudBase under `static/activity/`.
 * MongoDB stores object keys; the backend resolves HTTPS temp URLs at read time.
 *
 * Default: upload files already in assets/activity/ (does not overwrite local files).
 * Optional: --fetch-remote re-downloads official URLs into assets/activity/ first.
 *
 * Usage:
 *   npm run media:upload-activity-images
 *   npm run media:upload-activity-images -- --fetch-missing
 *   npm run media:upload-activity-images -- --fetch-remote
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activityImageCloudPath,
  downloadRemoteImage,
} from './lib/activity-image-cloud.mjs';
import { ACTIVITY_IMAGE_SOURCES } from './lib/activity-image-sources.mjs';
import { loadDotEnv } from './lib/discogs-crawl.mjs';
import { ACTIVITY_SEED } from './lib/activity-catalog-seed-data.mjs';
import {
  buildSeedImageIndex,
  listMissingLocalActivityImages,
  uploadLocalActivityImages,
} from './lib/upload-activity-images-core.mjs';

loadDotEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/activity');

async function fetchRemoteActivityImages() {
  await mkdir(ASSETS_DIR, { recursive: true });
  const seedByCode = new Map(ACTIVITY_SEED.map((item) => [item.code, item]));

  for (const item of ACTIVITY_IMAGE_SOURCES) {
    console.log(`⬇️  ${item.code}: ${item.sourceUrl}`);
    const { buffer, ext } = await downloadRemoteImage(item.sourceUrl);
    const cloudPath = activityImageCloudPath(item.code, ext);
    const seed = seedByCode.get(item.code);
    const filename = seed
      ? path.basename(seed.image)
      : path.basename(cloudPath);
    const localPath = path.join(ASSETS_DIR, filename);
    await writeFile(localPath, buffer);
    console.log(`   saved ${localPath}`);
  }
}

async function fetchMissingActivityImages() {
  await mkdir(ASSETS_DIR, { recursive: true });
  const existing = await readdir(ASSETS_DIR);
  const missing = listMissingLocalActivityImages(ASSETS_DIR, existing);
  if (!missing.length) {
    console.log('No missing local activity images.');
    return;
  }

  const sourceByCode = new Map(
    ACTIVITY_IMAGE_SOURCES.map((item) => [item.code, item]),
  );

  for (const item of missing) {
    const source = sourceByCode.get(item.seed.code);
    if (!source) {
      console.warn(`⚠️  skip ${item.seed.code}: no remote source configured`);
      continue;
    }
    console.log(`⬇️  ${item.seed.code}: ${source.sourceUrl}`);
    const { buffer } = await downloadRemoteImage(source.sourceUrl);
    await writeFile(item.assetsPath, buffer);
    console.log(`   saved ${item.assetsPath}`);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fetchRemote = process.argv.includes('--fetch-remote');
  const fetchMissing = process.argv.includes('--fetch-missing');

  if (fetchRemote) {
    await fetchRemoteActivityImages();
  } else if (fetchMissing) {
    await fetchMissingActivityImages();
  }

  const uploaded = await uploadLocalActivityImages({
    assetsDir: ASSETS_DIR,
    rootDir: ROOT,
    dryRun,
  });

  if (!uploaded.length) {
    console.error(
      '❌ No activity images uploaded. Place files under assets/activity/ or use --fetch-missing.',
    );
    process.exit(1);
  }

  console.log('\n✅ Activity images uploaded to CloudBase storage.');
  console.log('DB stores static/activity/* keys; backend resolves cloud URLs on read.');
  console.log('Restart backend (or wait for cache refresh) to serve new covers.');
}

main().catch((error) => {
  console.error('❌ Upload failed:', error?.message ?? error);
  process.exit(1);
});
