#!/usr/bin/env node
/**
 * Fetch lineup artist avatars AFTER name is confirmed in dj_discogs_map (status=mapped).
 * Stores public CDN URLs (TheAudioDB / manual) — no CloudBase upload.
 * Discogs avatars are no longer used (image URLs are unstable).
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
 *   LINEUP_AVATAR_MIN_SCORE=80 npm run db:sync-lineup-avatars   # score gate (default 80)
 *   LINEUP_AVATAR_GENRE_CHECK=0 npm run db:sync-lineup-avatars  # disable genre cross-check
 */

import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import {
  deleteLineupArtistAvatar,
  isRemoteLineupAvatarUrl,
  isStoredLineupAvatarUrl,
  isUsableLineupAvatarUrl,
  purgeDiscogsLineupAvatars,
  purgeLegacyLineupCloudAvatars,
  upsertLineupArtistAvatar,
} from './lib/lineup-avatar-cloud.mjs';
import {
  getCrawlConfig,
  loadActivityLineupArtistNames,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
  createDjDiscogsMapModel,
} from './lib/discogs-crawl.mjs';
import { listMappedLineupArtists } from './lib/dj-discogs-map.mjs';
import {
  createTheAudioDbClient,
  extractTheAudioDbGenres,
  getTheAudioDbConfig,
  isElectronicGenreCandidate,
  scoreTheAudioDbMatch,
} from './lib/theaudiodb-avatars.mjs';

loadDotEnv();

const MIN_SCORE = Number(process.env.LINEUP_AVATAR_MIN_SCORE ?? 80) || 80;
const GENRE_CHECK = process.env.LINEUP_AVATAR_GENRE_CHECK !== '0';

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
  return isStoredLineupAvatarUrl(row?.avatarUrl, row?.source);
}

function genresAreCompatible(djsStyles, candidateGenres) {
  if (!GENRE_CHECK) {
    return true;
  }
  const electronic = isElectronicGenreCandidate(candidateGenres);
  if (electronic === null) {
    // TheAudioDB has no genre info — don't reject
    return true;
  }
  if (!electronic) {
    // TheAudioDB says non-electronic → reject unless djs has no styles either
    if (!djsStyles?.length) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Pick the best TheAudioDB match across queries, applying score gate + genre check.
 * Order: canonical searchName first (more precise), then lineupName.
 */
async function resolveTheAudioDbAvatar({
  lineupName,
  searchName,
  audioDb,
  djsStyles,
}) {
  const candidates = [];
  if (searchName && searchName.trim()) {
    const match = await audioDb.searchArtist(searchName);
    if (match?.avatarUrl) {
      candidates.push({ ...match, searchedAs: 'searchName' });
    }
  }
  if (
    lineupName &&
    lineupName.trim().toLowerCase() !== (searchName ?? '').trim().toLowerCase()
  ) {
    const match = await audioDb.searchArtist(lineupName);
    if (match?.avatarUrl) {
      candidates.push({ ...match, searchedAs: 'lineupName' });
    }
  }

  if (!candidates.length) {
    return null;
  }

  // Prefer highest score; tie-break: searchName (canonical) first
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.searchedAs === 'searchName' ? -1 : 1;
  });

  for (const candidate of candidates) {
    if (candidate.score < MIN_SCORE) {
      continue;
    }
    if (!isRemoteLineupAvatarUrl(candidate.avatarUrl)) {
      continue;
    }
    if (!genresAreCompatible(djsStyles, candidate.genres)) {
      console.warn(
        `⚠️  TheAudioDB genre 不匹配（lineup=${lineupName}, candidate=${candidate.artistName}, genres=${(candidate.genres ?? []).join('/')})`,
      );
      continue;
    }
    return {
      url: candidate.avatarUrl,
      source: 'theaudiodb',
      matchScore: candidate.score,
      theAudioDbArtist: candidate.artistName,
      theAudioDbArtistId: candidate.theAudioDbArtistId ?? null,
      theAudioDbGenres: candidate.genres ?? [],
      searchQuery: candidate.searchQuery,
      searchedAs: candidate.searchedAs,
    };
  }

  // No candidate passed the gate — return the highest-score one flagged for review
  const best = candidates[0];
  if (best && isRemoteLineupAvatarUrl(best.avatarUrl)) {
    return {
      url: best.avatarUrl,
      source: 'theaudiodb',
      matchScore: best.score,
      theAudioDbArtist: best.artistName,
      theAudioDbArtistId: best.theAudioDbArtistId ?? null,
      theAudioDbGenres: best.genres ?? [],
      searchQuery: best.searchQuery,
      searchedAs: best.searchedAs,
      reviewFlag: best.score < MIN_SCORE ? 'low_score' : 'genre_mismatch',
    };
  }
  return null;
}

async function resolveSourceUrl({
  lineupName,
  searchName,
  manualUrls,
  audioDb,
  djsStyles,
}) {
  const manual = manualUrls[lineupName]?.trim();
  if (manual && isRemoteLineupAvatarUrl(manual)) {
    return { url: manual, source: 'manual', matchScore: 100 };
  }

  return resolveTheAudioDbAvatar({
    lineupName,
    searchName,
    audioDb,
    djsStyles,
  });
}

async function loadDjsStyleMap(db) {
  const rows = await db
    .collection('djs')
    .find({})
    .project({ name: 1, styles: 1 })
    .toArray();
  const byNameKey = new Map();
  for (const row of rows) {
    const key = (row.name ?? '').toLowerCase().trim();
    if (key) {
      byNameKey.set(key, row.styles ?? []);
    }
  }
  return byNameKey;
}

async function main() {
  const mongoConfig = getCrawlConfig();
  const manualUrls = loadUrlsFile();

  if (!mongoConfig.discogsToken) {
    console.warn('⚠️  DISCOGS_TOKEN 未设置（头像同步不再使用 Discogs，可忽略）');
  }

  await mongoose.connect(mongoConfig.mongoUri);
  const db = mongoose.connection.db;

  const purged = await purgeLegacyLineupCloudAvatars(db);
  if (purged) {
    console.log(`🗑️  已删除 ${purged} 条旧 CloudBase 头像记录`);
  }

  const purgedDiscogs = await purgeDiscogsLineupAvatars(db);
  if (purgedDiscogs) {
    console.log(`🗑️  已删除 ${purgedDiscogs} 条 Discogs 头像记录`);
  }

  const mapCollection = createDjDiscogsMapModel(mongoose).collection;
  const audioDb = createTheAudioDbClient(getTheAudioDbConfig());
  const djsStyleMap = await loadDjsStyleMap(db);

  const lineupNames = explicitNames?.length
    ? explicitNames
    : Number.isFinite(activityLegacyId)
      ? await loadActivityLineupArtistNames(db, activityLegacyId)
      : await loadAllCatalogLineupArtistNames(db, mongoConfig);

  const avatarTargets = await listMappedLineupArtists(
    mapCollection,
    lineupNames,
  );
  const skippedUnmapped = lineupNames.length - avatarTargets.length;

  const existingRows = await db
    .collection('lineup_artist_avatars')
    .find({})
    .project({ artistNameKey: 1, avatarUrl: 1, source: 1 })
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
  console.log('🌐 头像模式：CDN 直链（TheAudioDB / manual），不上传 CloudBase');
  console.log(
    `   分数门槛 ≥${MIN_SCORE}${GENRE_CHECK ? ' + genre 交叉校验' : ''}`,
  );
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
  let removed = 0;
  let flagged = 0;

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
        (searchName ? ` → ${searchName}` : ''),
    );

    const djsStyles = djsStyleMap.get((searchName ?? '').toLowerCase().trim())
      ?? djsStyleMap.get(key)
      ?? [];

    let sourceInfo;
    try {
      sourceInfo = await resolveSourceUrl({
        lineupName,
        searchName,
        manualUrls,
        audioDb,
        djsStyles,
      });
    } catch (error) {
      missed += 1;
      console.warn('⚠️  解析来源失败', error.message ?? error);
      continue;
    }

    if (!sourceInfo?.url) {
      missed += 1;
      console.warn('⚠️  未找到图片 URL');
      if (force && existing && !dryRun) {
        const deleted = await deleteLineupArtistAvatar(db, lineupName);
        if (deleted) {
          removed += 1;
          console.log('🗑️  已删除无效头像记录');
        }
      }
      continue;
    }

    if (!isUsableLineupAvatarUrl(sourceInfo.url, sourceInfo.source)) {
      missed += 1;
      console.warn('⚠️  来源 URL 不可用（Discogs）');
      if (force && existing && !dryRun) {
        const deleted = await deleteLineupArtistAvatar(db, lineupName);
        if (deleted) {
          removed += 1;
          console.log('🗑️  已删除无效头像记录');
        }
      }
      continue;
    }

    const scoreLabel = sourceInfo.matchScore !== undefined
      ? ` score=${sourceInfo.matchScore}`
      : '';
    const reviewLabel = sourceInfo.reviewFlag
      ? ` ⚠️ review=${sourceInfo.reviewFlag}`
      : '';
    console.log(
      `→ 来源 [${sourceInfo.source}]${scoreLabel}${reviewLabel} ${sourceInfo.url.slice(0, 80)}`,
    );

    if (dryRun) {
      saved += 1;
      if (sourceInfo.reviewFlag) {
        flagged += 1;
      }
      continue;
    }

    const ok = await upsertLineupArtistAvatar(db, {
      artistName: lineupName,
      avatarUrl: sourceInfo.url,
      source: sourceInfo.source,
      matchScore: sourceInfo.matchScore ?? null,
      theAudioDbArtist: sourceInfo.theAudioDbArtist ?? null,
      theAudioDbArtistId: sourceInfo.theAudioDbArtistId ?? null,
      theAudioDbGenres: sourceInfo.theAudioDbGenres ?? [],
      searchQuery: sourceInfo.searchQuery ?? null,
      reviewFlag: sourceInfo.reviewFlag ?? null,
    });
    if (!ok) {
      missed += 1;
      console.warn('⚠️  Mongo 写入失败');
      continue;
    }
    saved += 1;
    if (sourceInfo.reviewFlag) {
      flagged += 1;
    }
    console.log('✅ 已保存 CDN URL');
  }

  console.log(
    `\n🏁 完成：保存 ${saved} 条（其中 ${flagged} 条待复核），跳过 ${skipped} 条` +
      (removed ? `，删除 ${removed} 条` : '') +
      (missed ? `，未找到/失败 ${missed} 位` : ''),
  );
  if (flagged) {
    console.log(
      '🔍 复核低分/可疑记录：db.lineup_artist_avatars.find({ reviewFlag: { $ne: null } })',
    );
  }
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
