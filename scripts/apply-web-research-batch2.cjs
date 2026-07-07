/**
 * 第二批联网搜索结果 — 更新数据库
 * 用法: cd sync-app-backend && node scripts/apply-web-research-batch2.cjs
 */

const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';

function normKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ===== 名字格式修正 (OO→00、大小写、特殊字符) =====
const NAME_FIXES = [
  { wrong: 'John OO Fleming', correct: 'John 00 Fleming', discogsId: 11706, discogsName: "John '00' Fleming" },
  // 更多可能的格式问题可以在此添加
];

// ===== 新发现的 Discogs 映射 =====
const NEW_MAPPINGS = [
  {
    lineupName: 'John 00 Fleming',
    discogsId: 11706,
    discogsName: "John '00' Fleming",
    displayGenres: ['Trance', 'Psychedelic Trance', 'Progressive Trance'],
    displayStyles: ['Psy-Trance', 'Progressive'],
    country: 'UK',
    profileSummary: 'British trance & psy-trance DJ/producer (born 1969, Sunderland). Active since 1985. Founder of JOOF Recordings (1998). BBC Radio 1 Essential Mix alumnus. Over 10 million mix compilation sales. Performed at Cream, Gatecrasher, Ministry of Sound, Boom, Ozora, Tomorrowland, EDC.',
  },
  {
    lineupName: 'Symphony Of Unity',
    discogsId: 0,
    discogsName: 'Symphony Of Unity',
    displayGenres: ['Orchestral', 'Electronic'],
    displayStyles: ['Symphonic Electronic'],
    country: 'Belgium',
    profileSummary: 'Tomorrowland orchestral ensemble project (debuted 2015). 50+ musicians performing symphonic reworks of electronic dance anthems. Releases on Tomorrowland Music. Notable: "Reload", "Years" (Alesso), "Insomnia".',
    note: '这是 Tomorrowland 管弦乐项目，非传统 DJ/制作人。Discogs 有 release 页面但可能无 artist 页面。',
    isSpecial: true,
  },
  {
    lineupName: 'BYØRN',
    discogsId: 0,
    discogsName: 'BYØRN',
    displayGenres: ['Hard Techno', 'Hard Dance', 'Hardcore'],
    displayStyles: ['Neo Rave', 'Psy'],
    country: 'Belgium',
    profileSummary: 'Belgian hard techno DJ/producer (real name: Bjorn Verbeeck) from Antwerp. Beatport\'s best-selling hard techno artist 2024. Over 20 million streams. Releases on Exhale (Amelie Lens), No Mercy, Etruria Beat, Taapion. Notable: "Ragnarok" EP, "Ekstasis" EP.',
    note: 'Discogs artist ID 未确认。RA: ra.co/dj/byorn, Beatport: beatport.com/artist/byrn/1106234',
  },
  {
    lineupName: 'Fonsi Nieto',
    discogsId: 0,
    discogsName: 'Fonsi Nieto',
    displayGenres: ['House'],
    displayStyles: ['Electronic'],
    country: 'Spain',
    profileSummary: 'Spanish DJ/producer and former MotoGP racer. Debut album "Ten" (2018) on Clipper\'s Sounds, dedicated to his uncle Ángel Nieto. The number 10 was his racing number.',
    note: 'Discogs artist ID 未确认。Qobuz 列表有 16 张 release。',
  },
  {
    lineupName: 'Lucca Van Damme',
    discogsId: 0,
    discogsName: 'Lucca Van Damme',
    displayGenres: ['House'],
    displayStyles: ['Electronic'],
    country: 'Belgium',
    profileSummary: 'Belgian DJ/producer signed to Smash The House (Dimitri Vegas & Like Mike\'s label). Tomorrowland Academy success story.',
    note: 'Discogs artist ID 未确认。',
  },
];

// ===== 非艺人条目 (应标记或移除) =====
const NON_ARTISTS = [
  {
    lineupName: 'More to be announced',
    reason: '占位符，非真实艺人。应删除。',
    action: 'delete',
  },
  {
    lineupName: 'Symphony Of Unity',
    reason: 'Tomorrowland 管弦乐项目，非传统 DJ。已单独映射。',
    action: 'keep_as_special',
  },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('dj_discogs_map');
  console.log('✅ 已连接 MongoDB\n');

  // ─── 1. 名字格式修正 ───
  console.log('─── 名字格式修正 ───\n');
  for (const fix of NAME_FIXES) {
    const wrongKey = normKey(fix.wrong);
    const correctKey = normKey(fix.correct);

    // 查找错误名字的条目
    const existing = await collection.findOne({ lineupNameKey: wrongKey });
    if (existing) {
      // 更新条目
      await collection.updateOne(
        { lineupNameKey: wrongKey },
        {
          $set: {
            lineupNameKey: correctKey,
            lineupName: fix.correct,
            discogsId: fix.discogsId,
            discogsName: fix.discogsName,
            status: 'mapped',
            source: 'web-research-name-fix',
          },
        }
      );
      console.log(`  🔧 ${fix.wrong} → ${fix.correct} (discogs:${fix.discogsId})`);
    } else {
      console.log(`  ⚠️  未找到: ${fix.wrong}`);
    }
  }

  // ─── 2. 新增映射 ───
  console.log('\n─── 新增映射 ───\n');
  for (const m of NEW_MAPPINGS) {
    const key = normKey(m.lineupName);

    if (m.discogsId > 0) {
      const result = await collection.updateOne(
        { lineupNameKey: key },
        {
          $set: {
            lineupName: m.lineupName,
            discogsId: m.discogsId,
            discogsName: m.discogsName,
            status: 'mapped',
            displayGenres: m.displayGenres,
            displayStyles: m.displayStyles,
            source: 'web-research',
          },
          $setOnInsert: { lineupNameKey: key },
        },
        { upsert: true }
      );
      console.log(`  ✅ ${m.lineupName} → discogs:${m.discogsId}`);
    } else {
      const result = await collection.updateOne(
        { lineupNameKey: key },
        {
          $set: {
            lineupName: m.lineupName,
            discogsName: m.discogsName,
            status: m.isSpecial ? 'mapped' : 'pending_review',
            reviewReason: m.note || 'Discogs artist ID 待手动确认',
            displayGenres: m.displayGenres,
            displayStyles: m.displayStyles,
            source: 'web-research',
          },
          $setOnInsert: { lineupNameKey: key },
        },
        { upsert: true }
      );
      const label = m.isSpecial ? '🔷' : '⚠️';
      console.log(`  ${label} ${m.lineupName} — ${m.note || '待确认'}`);
    }
  }

  // ─── 3. 处理占位符 ───
  console.log('\n─── 非艺人处理 ───\n');
  for (const n of NON_ARTISTS) {
    if (n.action === 'delete') {
      const key = normKey(n.lineupName);
      const result = await collection.deleteOne({ lineupNameKey: key });
      if (result.deletedCount > 0) {
        console.log(`  🗑️  已删除: ${n.lineupName} — ${n.reason}`);
      } else {
        console.log(`  ⏭️  不存在: ${n.lineupName}`);
      }
    }
  }

  // ─── 4. 统计 ───
  console.log('\n─── 本次更新统计 ───');
  const tmlArtists = await db.collection('artist_performances')
    .find({ activityLegacyId: 7 }).toArray();
  const artistMap = new Map();
  for (const p of tmlArtists) {
    const k = normKey(p.artistName);
    if (!artistMap.has(k)) artistMap.set(k, p);
  }
  const total = artistMap.size;

  const allMaps = await db.collection('dj_discogs_map').find({}).toArray();
  const discogsByKey = new Map(allMaps.map(d => [d.lineupNameKey, d]));

  let mapped = 0, pending = 0, unmapped = 0;
  for (const [key, artist] of artistMap) {
    const map = discogsByKey.get(key);
    if (!map) unmapped++;
    else if (map.status === 'mapped') mapped++;
    else pending++;
  }

  console.log(`  总艺人: ${total}`);
  console.log(`  ✅ 已映射: ${mapped} (${(mapped/total*100).toFixed(1)}%)`);
  console.log(`  ⚠️  待审核: ${pending} (${(pending/total*100).toFixed(1)}%)`);
  console.log(`  ❌ 无映射: ${unmapped} (${(unmapped/total*100).toFixed(1)}%)`);

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}

main().catch(err => { console.error('失败:', err); process.exit(1); });
