#!/usr/bin/env node
/**
 * Download festival hero images and upload to CloudBase under `static/activity/`.
 * Updates MongoDB `activities.image` to the cloud object key.
 *
 * Usage:
 *   npm run media:sync-activity-images
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  getCloudBaseUploadConfig,
  getWeChatAccessToken,
  uploadBufferToCloudBase,
} from './lib/cloudbase-upload.mjs';
import {
  activityImageCloudPath,
  downloadRemoteImage,
} from './lib/activity-image-cloud.mjs';
import { loadDotEnv } from './lib/discogs-crawl.mjs';

loadDotEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets/activity');

/** Keep source URLs in sync with src/modules/activity/activity.seed.ts */
const ACTIVITY_IMAGE_SOURCES = [
  {
    legacyId: 1,
    code: 'tomorrowland',
    sourceUrl:
      'https://mma.prnewswire.com/media/2921955/Tomorrowland_Thailand_PR_Newswire.jpg',
  },
  {
    legacyId: 4,
    code: 'storm',
    sourceUrl:
      'https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
  },
  {
    legacyId: 5,
    code: 'edc-thailand',
    sourceUrl:
      'https://ik.imagekit.io/TBR/Island%20Events/EDC%20Thailand%202026.png?updatedAt=1763068886366',
  },
  {
    legacyId: 8,
    code: 'edc-korea',
    sourceUrl:
      'https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/73/2026/02/09161528/edck_2026_mk_an_fest_site_seo_1200x630_r01.png',
  },
];

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { envId, appId, appSecret } = getCloudBaseUploadConfig();

  if (!dryRun && (!envId || !appId || !appSecret)) {
    console.error(
      '❌ 请设置 CLOUDBASE_ENV_ID、WECHAT_MINI_APP_ID、WECHAT_MINI_APP_SECRET',
    );
    process.exit(1);
  }

  await mkdir(ASSETS_DIR, { recursive: true });

  const accessToken = dryRun
    ? ''
    : await getWeChatAccessToken(appId, appSecret);

  const uploaded = [];

  for (const item of ACTIVITY_IMAGE_SOURCES) {
    console.log(`⬇️  ${item.code}: ${item.sourceUrl}`);
    const { buffer, ext } = await downloadRemoteImage(item.sourceUrl);
    const cloudPath = activityImageCloudPath(item.code, ext);
    const localPath = path.join(ASSETS_DIR, path.basename(cloudPath));

    await writeFile(localPath, buffer);
    console.log(`   saved ${localPath}`);

    let fileId = `cloud://${envId || 'env'}/${cloudPath}`;
    if (!dryRun) {
      fileId = await uploadBufferToCloudBase({
        envId,
        accessToken,
        cloudPath,
        buffer,
      });
      console.log(`   uploaded -> ${fileId}`);
    }

    uploaded.push({
      legacyId: item.legacyId,
      code: item.code,
      cloudPath,
      fileId,
    });
  }

  if (!dryRun) {
    await mongoose.connect(uri);
    const activities = mongoose.connection.db.collection('activities');
    for (const item of uploaded) {
      await activities.updateOne(
        { legacyId: item.legacyId },
        { $set: { image: item.cloudPath } },
      );
      console.log(`   MongoDB legacyId=${item.legacyId} image=${item.cloudPath}`);
    }
    await mongoose.disconnect();
  }

  console.log('\n✅ Activity images synced to CloudBase storage.');
  console.log('Update activity.seed.ts / sync-activity-catalog.mjs image fields:');
  for (const item of uploaded) {
    console.log(`  ${item.code}: '${item.cloudPath}'`);
  }
}

main().catch((error) => {
  console.error('❌ Sync failed:', error?.message ?? error);
  process.exit(1);
});
