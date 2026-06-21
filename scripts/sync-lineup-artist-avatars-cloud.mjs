#!/usr/bin/env node
/**
 * Fetch lineup artist images (TheAudioDB or --urls-file), upload to CloudBase,
 * and store `lineup-avatar/` keys in MongoDB.
 *
 * Usage:
 *   npm run db:sync-lineup-avatars
 *   npm run db:sync-lineup-avatars -- --dry-run
 *   npm run db:sync-lineup-avatars -- --urls-file ./urls.json
 *   npm run db:sync-lineup-avatars -- --names "KANINE,SUBTRONICS"
 */

import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import {
  getCloudBaseUploadConfig,
  getWeChatAccessToken,
  uploadBufferToCloudBase,
} from './lib/cloudbase-upload.mjs';
import {
  downloadRemoteImage,
  isLineupAvatarAssetKey,
  lineupAvatarCloudPath,
  upsertLineupArtistAvatar,
} from './lib/lineup-avatar-cloud.mjs';
import {
  getCrawlConfig,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import {
  createTheAudioDbClient,
  getTheAudioDbConfig,
} from './lib/theaudiodb-avatars.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const missingOnly = args.includes('--missing-only');
const namesArgIndex = args.indexOf('--names');
const urlsFileIndex = args.indexOf('--urls-file');

const explicitNames =
  namesArgIndex >= 0
    ? args[namesArgIndex + 1]
        ?.split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    : null;

function loadUrlsFile() {
  if (urlsFileIndex < 0) {
    return {};
  }
  const filePath = args[urlsFileIndex + 1];
  if (!filePath) {
    throw new Error('--urls-file requires a path');
  }
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--urls-file must be a JSON object');
  }
  return parsed;
}

function isRemoteImageUrl(url) {
  return Boolean(url?.trim()) && /^https?:\/\//i.test(url.trim());
}

async function resolveSourceUrl({ lineupName, manualUrls, audioDb }) {
  const manual = manualUrls[lineupName]?.trim();
  if (manual && isRemoteImageUrl(manual)) {
    return { url: manual, source: 'manual' };
  }

  const match = await audioDb.searchArtist(lineupName);
  if (match?.avatarUrl && isRemoteImageUrl(match.avatarUrl)) {
    return { url: match.avatarUrl, source: 'theaudiodb' };
  }

  return null;
}

async function main() {
  const mongoConfig = getCrawlConfig();
  const cloudConfig = getCloudBaseUploadConfig();
  const manualUrls = loadUrlsFile();

  if (!dryRun) {
    if (!cloudConfig.envId || !cloudConfig.appId || !cloudConfig.appSecret) {
      console.error(
        '❌ 请设置 CLOUDBASE_ENV_ID、WECHAT_MINI_APP_ID、WECHAT_MINI_APP_SECRET',
      );
      process.exit(1);
    }
  }

  await mongoose.connect(mongoConfig.mongoUri);
  const db = mongoose.connection.db;
  const audioDb = createTheAudioDbClient(getTheAudioDbConfig());

  const lineupNames = explicitNames?.length
    ? explicitNames
    : await loadAllCatalogLineupArtistNames(db, mongoConfig);

  const existingRows = await db
    .collection('lineup_artist_avatars')
    .find({})
    .project({ artistNameKey: 1, avatarUrl: 1 })
    .toArray();
  const byKey = new Map(existingRows.map((row) => [row.artistNameKey, row]));

  let targets = lineupNames;
  if (missingOnly) {
    targets = lineupNames.filter((name) => {
      const row = byKey.get(name.trim().toLowerCase());
      return !isLineupAvatarAssetKey(row?.avatarUrl);
    });
  }

  console.log('✅ MongoDB:', mongoConfig.mongoUri);
  console.log(`☁️  CloudBase env: ${cloudConfig.envId || '(dry-run)'}`);
  console.log(`🎤 待处理 ${targets.length} 位艺人`);
  if (dryRun) {
    console.log('ℹ️  dry-run 模式');
  }

  const accessToken = dryRun
    ? null
    : await getWeChatAccessToken(cloudConfig.appId, cloudConfig.appSecret);

  let uploaded = 0;
  let skipped = 0;
  let missed = 0;

  for (const lineupName of targets) {
    const key = lineupName.trim().toLowerCase();
    const existing = byKey.get(key);

    if (isLineupAvatarAssetKey(existing?.avatarUrl)) {
      skipped += 1;
      console.log(`↷ 已在 CloudBase: ${lineupName}`);
      continue;
    }

    console.log(`\n处理: ${lineupName}`);

    let sourceInfo;
    try {
      sourceInfo = await resolveSourceUrl({
        lineupName,
        manualUrls,
        audioDb,
      });
    } catch (error) {
      missed += 1;
      console.warn('⚠️  解析来源失败', error.message ?? error);
      continue;
    }

    if (!sourceInfo?.url) {
      missed += 1;
      console.warn('⚠️  未找到图片 URL');
      continue;
    }

    console.log(
      `→ 来源 [${sourceInfo.source}] ${sourceInfo.url.slice(0, 72)}...`,
    );

    const assetKey = lineupAvatarCloudPath(lineupName, 'jpg');
    if (dryRun) {
      console.log(`   将上传至 ${assetKey}`);
      uploaded += 1;
      continue;
    }

    try {
      const { buffer, ext } = await downloadRemoteImage(sourceInfo.url);
      const assetKey = lineupAvatarCloudPath(lineupName, ext);
      await uploadBufferToCloudBase({
        envId: cloudConfig.envId,
        accessToken,
        cloudPath: assetKey,
        buffer,
      });
      const ok = await upsertLineupArtistAvatar(db, {
        artistName: lineupName,
        avatarUrl: assetKey,
        source: sourceInfo.source,
      });
      if (!ok) {
        missed += 1;
        console.warn('⚠️  Mongo 写入失败');
        continue;
      }
      uploaded += 1;
      console.log(`✅ ${assetKey}`);
    } catch (error) {
      missed += 1;
      console.warn('⚠️  上传失败', error.message ?? error);
    }
  }

  console.log(
    `\n🏁 完成：上传 ${uploaded} 条，跳过 ${skipped} 条` +
      (missed ? `，未找到/失败 ${missed} 位` : ''),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 同步失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
