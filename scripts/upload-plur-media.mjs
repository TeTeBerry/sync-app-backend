#!/usr/bin/env node
/**
 * Upload PLUR static images to CloudBase storage under `static/plur/`.
 *
 * Sources (sync-app, removed after first upload):
 *   src/assets/plur/peace-entry-cover.jpg
 *   h5/plur-film/src/assets/scenes/{peace,love,unity,respect}.jpg
 *
 * Usage:
 *   npm run media:upload-plur
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getCloudBaseUploadConfig,
  getWeChatAccessToken,
  uploadBufferToCloudBase,
} from './lib/cloudbase-upload.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const SYNC_APP_ROOT = path.resolve(BACKEND_ROOT, '../sync-app');
const STATIC_PREFIX = 'static/plur';

const FILES = [
  {
    localPaths: [
      path.join(SYNC_APP_ROOT, 'src/assets/plur/peace-entry-cover.jpg'),
      path.join(
        SYNC_APP_ROOT,
        'h5/plur-film/dist/assets/peace-DXAWZoI6.jpg',
      ),
    ],
    cloudPath: `${STATIC_PREFIX}/peace-entry-cover.jpg`,
  },
  {
    localPaths: [
      path.join(SYNC_APP_ROOT, 'h5/plur-film/src/assets/scenes/peace.jpg'),
      path.join(SYNC_APP_ROOT, 'h5/plur-film/dist/assets/peace-DXAWZoI6.jpg'),
    ],
    cloudPath: `${STATIC_PREFIX}/scenes/peace.jpg`,
  },
  {
    localPaths: [
      path.join(SYNC_APP_ROOT, 'h5/plur-film/src/assets/scenes/love.jpg'),
      path.join(SYNC_APP_ROOT, 'h5/plur-film/dist/assets/love-Bv4zeiez.jpg'),
    ],
    cloudPath: `${STATIC_PREFIX}/scenes/love.jpg`,
  },
  {
    localPaths: [
      path.join(SYNC_APP_ROOT, 'h5/plur-film/src/assets/scenes/unity.jpg'),
      path.join(SYNC_APP_ROOT, 'h5/plur-film/dist/assets/unity-C2a79RV4.jpg'),
    ],
    cloudPath: `${STATIC_PREFIX}/scenes/unity.jpg`,
  },
  {
    localPaths: [
      path.join(SYNC_APP_ROOT, 'h5/plur-film/src/assets/scenes/respect.jpg'),
      path.join(SYNC_APP_ROOT, 'h5/plur-film/dist/assets/respect-CJP60C4W.jpg'),
    ],
    cloudPath: `${STATIC_PREFIX}/scenes/respect.jpg`,
  },
];

function resolveLocalPath(localPaths) {
  for (const candidate of localPaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

async function main() {
  const files = FILES.map((file) => ({
    cloudPath: file.cloudPath,
    localPath: resolveLocalPath(file.localPaths),
  })).filter((file) => file.localPath);

  if (!files.length) {
    console.error('No PLUR image sources found (sync-app src or h5/plur-film/dist).');
    for (const file of FILES) {
      console.error(`  ${file.cloudPath} <- ${file.localPaths.join(' | ')}`);
    }
    process.exit(1);
  }
  const { envId, appId, appSecret } = getCloudBaseUploadConfig();

  if (!envId || !appId || !appSecret) {
    console.log('Set CLOUDBASE_ENV_ID, WECHAT_MINI_APP_ID, WECHAT_MINI_APP_SECRET.\n');
    for (const file of files) {
      console.log(`  ${file.localPath} -> ${file.cloudPath}`);
    }
    process.exit(0);
  }

  const accessToken = await getWeChatAccessToken(appId, appSecret);
  for (const file of files) {
    const buffer = await readFile(file.localPath);
    const fileId = await uploadBufferToCloudBase({
      envId,
      accessToken,
      cloudPath: file.cloudPath,
      buffer,
    });
    console.log(`Uploaded ${file.cloudPath} -> ${fileId}`);
  }

  console.log('✅ PLUR media uploaded to CloudBase storage.');
}

main().catch((error) => {
  console.error('❌ Upload failed:', error?.message ?? error);
  process.exit(1);
});
