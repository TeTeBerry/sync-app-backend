#!/usr/bin/env node
/**
 * Upload Raver avatar PNGs to CloudBase storage under `avatar/`.
 *
 * Usage:
 *   npm run media:upload-raver-avatars
 *   CLOUDBASE_ENV_ID=... WECHAT_MINI_APP_ID=... WECHAT_MINI_APP_SECRET=... node scripts/upload-raver-avatars.mjs
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/avatar');
const CLOUD_PREFIX = 'avatar';

async function getAccessToken(appId, appSecret) {
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  const response = await fetch(url);
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error(payload.errmsg || 'Failed to fetch WeChat access token');
  }
  return payload.access_token;
}

async function uploadToCloud({ envId, accessToken, cloudPath, buffer }) {
  const response = await fetch(
    `https://api.weixin.qq.com/tcb/uploadfile?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        env: envId,
        path: cloudPath,
      }),
    },
  );
  const payload = await response.json();

  if (payload.errcode && payload.errcode !== 0) {
    throw new Error(payload.errmsg || `uploadfile failed (${payload.errcode})`);
  }
  if (!payload.url || !payload.token || !payload.authorization || !payload.cos_file_id) {
    throw new Error(`uploadfile response incomplete for ${cloudPath}`);
  }

  const form = new FormData();
  form.append('key', cloudPath);
  form.append('Signature', payload.authorization);
  form.append('x-cos-security-token', payload.token);
  form.append('x-cos-meta-fileid', payload.cos_file_id);
  form.append('file', new Blob([buffer]), path.basename(cloudPath));

  const uploadResponse = await fetch(payload.url, {
    method: 'POST',
    body: form,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`COS upload failed for ${cloudPath}: ${uploadResponse.status} ${text}`);
  }

  return payload.file_id ?? `cloud://${envId}/${cloudPath}`;
}

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

  const envId = process.env.CLOUDBASE_ENV_ID?.trim();
  const appId = process.env.WECHAT_MINI_APP_ID?.trim();
  const appSecret = process.env.WECHAT_MINI_APP_SECRET?.trim();

  if (!envId || !appId || !appSecret) {
    console.log('Set CLOUDBASE_ENV_ID, WECHAT_MINI_APP_ID, WECHAT_MINI_APP_SECRET.\n');
    for (const file of files) {
      console.log(`  ${file.localPath} -> ${file.cloudPath}`);
    }
    process.exit(0);
  }

  const accessToken = await getAccessToken(appId, appSecret);
  for (const file of files) {
    const buffer = await readFile(file.localPath);
    const fileId = await uploadToCloud({
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
