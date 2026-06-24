#!/usr/bin/env node
/**
 * Report Defqon.1 lineup artist Discogs + avatar coverage gaps.
 *
 * Usage:
 *   npm run db:report-defqon-gaps
 *   npm run db:report-defqon-gaps -- --write-json
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  getCrawlConfig,
  isLineupArtistCovered,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { expandFestivalArtistNames } from './lib/festival-lineup-fallback.mjs';
import { isLineupAvatarAssetKey } from './lib/lineup-avatar-cloud.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACTIVITY_LEGACY_ID = 2;
const writeJson = process.argv.includes('--write-json');

const HEADLINER_TOKENS = [
  'ANGERFIST',
  'BRENNAN HEART',
  'DA TWEEKAZ',
  'SUB ZERO PROJECT',
  'SOUND RUSH',
  'WILDSTYLEZ',
  'SHOWTEK',
  'VERTILE',
  'FRONTLINER',
  'HARD DRIVER',
  'PHUTURE NOIZE',
  'ROOLER',
  'WARFACE',
  'B-FRONT',
  'GUNZ FOR HIRE',
  'ENDYMION',
  'KORSAKOFF',
  'NOSFERATU',
  'PAUL ELSTAK',
  'LNY TNZ',
  'ART OF FIGHTERS',
  'THA PLAYAH',
  'COONE',
  'NOISECONTROLLERS',
  'ZATOX',
  'MAD DOG',
  'D-STURB',
  'REJECTA',
  'E-FORCE',
  'ACT OF RAGE',
  'WASTED PENGUINZ',
  'BEN NICKY',
  'PRIMESHOCK',
  'ADRENALIZE',
  'AUDIOTRICZ',
  'PSYKO PUNKZ',
  'ADJUZT',
  'CHAPTER V',
  'GALACTIXX',
  'MAX ENFORCER',
  'THE VIPER',
  'PROMO',
  'CHARLY LOWNOISE',
  'MENTAL THEO',
  'DJ ISAAC',
  'ALPHA TWINS',
  'THE PITCHER',
  'BASS MODULATORS',
  'ALPHAVERB',
  'ACTIVATOR',
  'DAVIDE SONAR',
  'NEOPHYTE',
  'BILLX',
  'KELTEK',
];

function classifyKind(name) {
  const upper = name.toUpperCase();
  if (
    /LEGENDS|ENDSHOW|CLOSING|RITUAL|POWER HOUR|WARRIOR|WORKOUT|PODCAST|SHOWCASE|CONTEST|PARADE|WARMING|ERROR_404|AIRBED|PIANO|SING A LONG|HOUR SET|BACK 2 BASICS|EVERYTHING CHANGES|AMONG THE NOISE|LIVE OR DIE|CHOOSE YOUR ERA|CLASSIC JOURNEY|PRESENTS:|PRESENT |PRES\.|GEKKENHUIS|MORNING WORKOUT|STRAIGHT OUTTA|SHOTS 'N|BOUNCE SET|REVERSE BASS|EIERBAL|UPTEMPO FIESTA|DOMINATION|RAVE NATION|BELGIAN BOYBAND|INDUSTRIAL RAVE|HOUSE OF MADNESS|NORMAL MUSIC/.test(
      upper,
    )
  ) {
    return 'showcase';
  }
  if (/B2B|& | X | VS /.test(upper)) {
    return 'collab';
  }
  return 'solo';
}

function isHeadliner(name) {
  const upper = name.toUpperCase();
  return HEADLINER_TOKENS.some((token) => upper === token || upper.includes(token));
}

function formatRow(row) {
  const gaps = [];
  if (row.discogs === 'missing') gaps.push('Discogs');
  if (row.avatar === 'missing') gaps.push('头像');
  return `| ${row.name} | ${row.kind} | ${gaps.join(', ') || '—'} |`;
}

loadDotEnv();

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;

  const performanceNames = await db
    .collection('artist_performances')
    .distinct('artistName', { activityLegacyId: ACTIVITY_LEGACY_ID });
  const names = expandFestivalArtistNames(performanceNames);
  const djs = await db
    .collection('djs')
    .find({})
    .project({ name: 1 })
    .toArray();
  const avatars = await db
    .collection('lineup_artist_avatars')
    .find({})
    .project({ artistNameKey: 1, avatarUrl: 1 })
    .toArray();
  const avatarByKey = new Map(avatars.map((row) => [row.artistNameKey, row]));

  const rows = names
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => ({
      name,
      kind: classifyKind(name),
      headliner: isHeadliner(name),
      discogs: isLineupArtistCovered(name, djs) ? 'ok' : 'missing',
      avatar: isLineupAvatarAssetKey(
        avatarByKey.get(name.trim().toLowerCase())?.avatarUrl,
      )
        ? 'ok'
        : 'missing',
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    activityLegacyId: ACTIVITY_LEGACY_ID,
    summary: {
      performanceSlots: performanceNames.length,
      expandedNames: names.length,
      discogsOk: rows.filter((row) => row.discogs === 'ok').length,
      avatarOk: rows.filter((row) => row.avatar === 'ok').length,
      bothOk: rows.filter(
        (row) => row.discogs === 'ok' && row.avatar === 'ok',
      ).length,
      missingDiscogs: rows.filter((row) => row.discogs === 'missing').length,
      missingAvatar: rows.filter((row) => row.avatar === 'missing').length,
    },
    headlinerGaps: rows.filter(
      (row) =>
        row.headliner &&
        (row.discogs === 'missing' || row.avatar === 'missing'),
    ),
    discogsMissing: rows.filter((row) => row.discogs === 'missing'),
    avatarMissing: rows.filter((row) => row.avatar === 'missing'),
    showcaseGaps: rows.filter(
      (row) =>
        row.kind === 'showcase' &&
        (row.discogs === 'missing' || row.avatar === 'missing'),
    ),
    complete: rows.filter(
      (row) => row.discogs === 'ok' && row.avatar === 'ok',
    ),
  };

  console.log('Defqon.1 2026 艺人档案 / 头像覆盖');
  console.log(`MongoDB: ${config.mongoUri}`);
  console.log('');
  console.log(
    `演出 slot ${payload.summary.performanceSlots} → 展开去重 ${payload.summary.expandedNames} 位`,
  );
  console.log(
    `Discogs ${payload.summary.discogsOk} ok / ${payload.summary.missingDiscogs} 缺`,
  );
  console.log(
    `头像 ${payload.summary.avatarOk} ok / ${payload.summary.missingAvatar} 缺`,
  );
  console.log(`双齐全 ${payload.summary.bothOk} 位`);
  console.log('');

  console.log('## Headliner 缺口（优先补）');
  console.log('| 艺人 | 类型 | 缺 |');
  console.log('| --- | --- | --- |');
  for (const row of payload.headlinerGaps) {
    console.log(formatRow(row));
  }
  console.log('');

  console.log('## 专场 / 活动名（可跳过自动抓取）');
  console.log(`共 ${payload.showcaseGaps.length} 条`);
  for (const row of payload.showcaseGaps.slice(0, 20)) {
    console.log(`- ${row.name}`);
  }
  if (payload.showcaseGaps.length > 20) {
    console.log(`- … 另有 ${payload.showcaseGaps.length - 20} 条`);
  }
  console.log('');

  console.log('## 建议下一步');
  console.log(
    '1. 补 `DISCOGS_LINEUP_SEARCH_ALIASES` / `THEAUDIODB_SEARCH_ALIASES`（scripts/lib/festival-lineup-fallback.mjs）',
  );
  console.log('2. npm run db:crawl-defqon-artists');
  console.log('3. npm run db:sync-defqon-avatars');
  console.log('4. npm run db:sync-lineup-artist-catalog:all');

  if (writeJson) {
    const outDir = join(ROOT, 'scripts', 'data');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'defqon1-lineup-gaps.json');
    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\n📄 JSON: ${outPath}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
