#!/usr/bin/env node
/**
 * Upload Raver avatar PNGs to CloudBase storage under `avatar/`.
 *
 * Usage:
 *   npm run media:upload-raver-avatars
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getCloudBaseUploadConfig,
  getWeChatAccessToken,
  uploadBufferToCloudBase,
} from './lib/cloudbase-upload.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/avatar');
const CLOUD_PREFIX = 'avatar';

async function main() {
  if (!existsSync(ASSETS_DIR)) {
    console.error(`Missing assets directory: ${ASSETS_DIR}`);
    process.exit(1);
  }

  const fileNames = (await readdir(ASSETS_DIR))
    .filter((name) => !name.startsWith('.') && !name.endsWith('.md'))
    .sort();

  if (!fileNames.length) {
    console.error('No avatar files found in assets/avatar');
    process.exit(1);
  }

  const files = fileNames.map((name) => ({
    localPath: path.join(ASSETS_DIR, name),
    cloudPath: `${CLOUD_PREFIX}/${name}`,
  }));

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

  console.log('✅ Raver avatars uploaded to CloudBase storage.');
}

main().catch((error) => {
  console.error('❌ Upload failed:', error?.message ?? error);
  process.exit(1);
});
