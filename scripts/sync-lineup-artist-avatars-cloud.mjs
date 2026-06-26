#!/usr/bin/env node
/**
 * Fetch lineup artist avatars AFTER name is confirmed in dj_discogs_map (status=mapped).
 * Stores public CDN URLs (Discogs img.discogs.com / TheAudioDB) — no CloudBase upload.
 *
 * Run order:
 *   1. npm run db:crawl-catalog-artists -- --rematch-mapped
 *   2. npm run db:sync-lineup-avatars
 *
 * Usage:
 *   npm run db:sync-lineup-avatars
 *   npm run db:sync-lineup-avatars -- --dry-run
 *   npm run db:sync-lineup-avatars -- --urls-file ./urls.json
 *   npm run db:sync-lineup-avatars -- --names "KANINE,SUBTRONICS"
 *   npm run db:sync-lineup-avatars -- --activity-legacy-id 2
 *   npm run db:sync-lineup-avatars:force -- --names "KANINE"
 */

import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { pickDiscogsArtistImageUrl } from './lib/discogs-image.mjs';
import {
  isRemoteLineupAvatarUrl,
  isStoredLineupAvatarUrl,
  purgeLegacyLineupCloudAvatars,
  upsertLineupArtistAvatar,
} from './lib/lineup-avatar-cloud.mjs';
import {
  createDiscogsClient,
  getCrawlConfig,
  loadActivityLineupArtistNames,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
  createDjDiscogsMapModel,
} from './lib/discogs-crawl.mjs';
import { listMappedLineupArtists } from './lib/dj-discogs-map.mjs';
import {
  createTheAudioDbClient,
  getTheAudioDbConfig,
} from './lib/theaudiodb-avatars.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const missingOnly = !force && args.includes('--missing-only');
const namesArgIndex = args.indexOf('--names');
const urlsFileIndex = args.indexOf('--urls-file');
const activityLegacyIdArg = args.indexOf('--activity-legacy-id');
const activityLegacyId =
  activityLegacyIdArg >= 0
    ? Number(args[activityLegacyIdArg + 1])
    : Number.NaN;

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

function hasStoredAvatar(row) {
  return isStoredLineupAvatarUrl(row?.avatarUrl);
}

async function resolveDiscogsAvatarUrl(discogs, discogsId) {
  if (!discogsId) {
    return null;
  }
  try {
    const artist = await discogs.discogsGet(
      `https://api.discogs.com/artists/${discogsId}`,
    );
    const imageUrl = pickDiscogsArtistImageUrl(artist.images);
    if (imageUrl) {
      return { url: imageUrl, source: 'discogs' };
    }
  } catch (error) {
    console.warn('⚠️  Discogs 头像读取失败', discogsId, error.message ?? error);
  }
  return null;
}

async function resolveSourceUrl({
  lineupName,
  searchName,
  discogsId,
  manualUrls,
  audioDb,
  discogs,
}) {
  const manual = manualUrls[lineupName]?.trim();
  if (manual && isRemoteLineupAvatarUrl(manual)) {
    return { url: manual, source: 'manual' };
  }

  const discogsAvatar = await resolveDiscogsAvatarUrl(discogs, discogsId);
  if (discogsAvatar) {
    return discogsAvatar;
  }

  const match = await audioDb.searchArtist(lineupName);
  if (match?.avatarUrl && isRemoteLineupAvatarUrl(match.avatarUrl)) {
    return { url: match.avatarUrl, source: 'theaudiodb' };
  }

  if (
    searchName &&
    searchName.trim().toLowerCase() !== lineupName.trim().toLowerCase()
  ) {
    const fallbackMatch = await audioDb.searchArtist(searchName);
    if (
      fallbackMatch?.avatarUrl &&
      isRemoteLineupAvatarUrl(fallbackMatch.avatarUrl)
    ) {
      return { url: fallbackMatch.avatarUrl, source: 'theaudiodb' };
    }
  }

  return null;
}

async function main() {
  const mongoConfig = getCrawlConfig();
  const manualUrls = loadUrlsFile();

  if (!mongoConfig.discogsToken) {
    console.error('❌ 请设置 DISCOGS_TOKEN');
    process.exit(1);
  }

  await mongoose.connect(mongoConfig.mongoUri);
  const db = mongoose.connection.db;

  const purged = await purgeLegacyLineupCloudAvatars(db);
  if (purged) {
    console.log(`🗑️  已删除 ${purged} 条旧 CloudBase 头像记录`);
  }

  const mapCollection = createDjDiscogsMapModel(mongoose).collection;
  const audioDb = createTheAudioDbClient(getTheAudioDbConfig());
  const discogs = createDiscogsClient(mongoConfig);

  const lineupNames = explicitNames?.length
    ? explicitNames
    : Number.isFinite(activityLegacyId)
      ? await loadActivityLineupArtistNames(db, activityLegacyId, mongoConfig)
      : await loadAllCatalogLineupArtistNames(db, mongoConfig);

  const avatarTargets = await listMappedLineupArtists(
    mapCollection,
    lineupNames,
  );
  const skippedUnmapped = lineupNames.length - avatarTargets.length;

  const existingRows = await db
    .collection('lineup_artist_avatars')
    .find({})
    .project({ artistNameKey: 1, avatarUrl: 1 })
    .toArray();
  const byKey = new Map(existingRows.map((row) => [row.artistNameKey, row]));

  let targets = avatarTargets;
  if (missingOnly) {
    targets = avatarTargets.filter((item) => {
      const row = byKey.get(item.lineupName.trim().toLowerCase());
      return !hasStoredAvatar(row);
    });
  }

  console.log('✅ MongoDB:', mongoConfig.mongoUri);
  console.log('🌐 头像模式：CDN 直链（Discogs / TheAudioDB），不上传 CloudBase');
  console.log(
    `ℹ️  仅处理 dj_discogs_map 已确认艺人（mapped）；未确认 ${skippedUnmapped} 位已跳过`,
  );
  console.log(`🎤 待处理 ${targets.length} 位艺人`);
  if (dryRun) {
    console.log('ℹ️  dry-run 模式');
  }

  let saved = 0;
  let skipped = 0;
  let missed = 0;

  for (const { lineupName, searchName, discogsId } of targets) {
    const key = lineupName.trim().toLowerCase();
    const existing = byKey.get(key);

    if (!force && hasStoredAvatar(existing)) {
      skipped += 1;
      console.log(`↷ 已有头像: ${lineupName}`);
      continue;
    }

    console.log(
      `\n处理: ${lineupName}` +
        (discogsId ? ` → #${discogsId} (${searchName})` : ''),
    );

    let sourceInfo;
    try {
      sourceInfo = await resolveSourceUrl({
        lineupName,
        searchName,
        discogsId,
        manualUrls,
        audioDb,
        discogs,
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
      `→ 来源 [${sourceInfo.source}] ${sourceInfo.url.slice(0, 80)}`,
    );

    if (dryRun) {
      saved += 1;
      continue;
    }

    const ok = await upsertLineupArtistAvatar(db, {
      artistName: lineupName,
      avatarUrl: sourceInfo.url,
      source: sourceInfo.source,
    });
    if (!ok) {
      missed += 1;
      console.warn('⚠️  Mongo 写入失败');
      continue;
    }
    saved += 1;
    console.log('✅ 已保存 CDN URL');
  }

  console.log(
    `\n🏁 完成：保存 ${saved} 条，跳过 ${skipped} 条` +
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
