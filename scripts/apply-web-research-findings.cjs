/**
 * 应用联网搜索结果到数据库
 * - 新增 Discogs 映射
 * - 标记无法映射的艺人
 * - 处理 B2B/F2F 组合
 *
 * 用法: cd sync-app-backend && node scripts/apply-web-research-findings.cjs
 */

const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';

// ========== 联网搜索发现的 Discogs 映射 ==========
// 格式: { lineupNameKey, lineupName, discogsId, discogsName, displayGenres, displayStyles, country, profileSummary }

const FOUND_MAPPINGS = [
  {
    lineupName: 'Sedef Adasï',
    discogsId: 7898226,
    discogsName: 'Sedef Adasi',
    displayGenres: ['Techno', 'House', 'Electro', 'Disco'],
    displayStyles: ['Proto-Disco', 'Acid', 'Breaks'],
    country: 'Germany',
    profileSummary: 'Turkish-Albanian DJ/producer based in Augsburg, Germany. Resident at Munich Blitz Club and Berlin Panorama Bar. Founder of HAMAM Nights event series. Debut EP "Fantasy Zone" (2021) on Public Possession. Known for genre-hopping sets blending proto-disco, techno, acid, house breaks, electro, and 80s/90s pop.',
  },
  {
    lineupName: 'Sofía Cristo',
    discogsId: 1769971,
    discogsName: 'Sofia Cristo Garcia',
    displayGenres: ['Techno', 'House'],
    displayStyles: ['Electronic'],
    country: 'Spain',
    profileSummary: 'Spanish DJ/producer (born 1983), daughter of Bárbara Rey and Ángel Cristo. Releases on Kitsune Records. Style spans techno, house, and electronic.',
  },
  {
    lineupName: 'Mark With A K',
    discogsId: 111419,
    discogsName: 'Mark With A K',
    displayGenres: ['Hardstyle', 'Jumpstyle'],
    displayStyles: ['Hard Dance', 'Tekstyle'],
    country: 'Belgium',
    profileSummary: 'Belgian hardstyle/jumpstyle DJ and producer (real name: Mark Carpentier). Active since 2003. Founder of Noize Junky label. Key figure in Belgian harder styles scene.',
  },
  {
    lineupName: 'SHDW',
    discogsId: 4507074,
    discogsName: 'SHDW',
    displayGenres: ['Techno'],
    displayStyles: ['Peak Time Techno', 'Driving Techno', 'Raw Techno', 'Hypnotic Techno'],
    country: 'Germany',
    profileSummary: 'German techno producer/DJ (real name: Marco Bläsi) from Plochingen near Stuttgart. Co-founder of From Another Mind and Mutual Rytm labels with Obscure Shape. Releases on Rekids, Dynamic Reflection, Soma Records, Planet Rhythm.',
  },
  {
    lineupName: 'Von Bikräv',
    discogsId: 0, // 未找到确切 artist ID，但有 release 页面
    discogsName: 'Von Bikräv',
    displayGenres: ['Gabber', 'Hardcore'],
    displayStyles: ['Frapcore', 'Frenchcore'],
    country: 'France',
    profileSummary: 'French DJ/producer, member of Casual Gabberz collective. Pioneer of "frapcore" genre blending gangsta rap with gabber techno. Founder of 20CONTRE1 label (2023). Notable releases: "100% Bibi" (2019), "XTSPD", "Evil Bikräv" (with Evil Grimace).',
    note: 'Discogs artist ID 未确认，需手动查找。Discogs release: 14108353, 13017362',
  },
  {
    lineupName: 'Öona Dahl',
    discogsId: 0, // 未找到确切 artist ID
    discogsName: 'Öona Dahl',
    displayGenres: ['Deep House', 'Melodic House & Techno', 'Progressive House'],
    displayStyles: ['Indie Dance', 'Ambient', 'Electronica'],
    country: 'USA',
    profileSummary: 'American DJ/producer from Upstate New York, based in Berlin. Releases on Anjunadeep, Watergate Records, All Day I Dream, Hallucienda. Has performed at Tomorrowland, EDC, Ultra, Boom Festival. Albums: "Holograma" (2017), "Morph" (2021).',
    note: 'Discogs artist ID 未确认。Discogs release: 5957046, 12143077',
  },
  {
    lineupName: 'David Löhlein',
    discogsId: 0, // 未找到确切 artist ID
    discogsName: 'David Löhlein',
    displayGenres: ['Techno'],
    displayStyles: ['Hard Techno', 'Industrial Techno'],
    country: 'Germany',
    profileSummary: 'German techno producer. Notable releases: "Seyla EP" on SK_Eleven, "VISION I - Nysa EP" on VISION label, releases on KEY Vinyl. Collaborations with Rove Ranger.',
    note: 'Discogs artist ID 未确认。Discogs release: 14804509, master: 1685499',
  },
];

// ========== B2B/F2F 组合需要拆分 ==========
// 这些艺人名包含 B2B/F2F，应该拆分为独立艺人

const B2B_TO_SPLIT = [
  {
    compositeName: 'Mark With A K & MC Chucky: Classics Set',
    splitArtists: [
      { name: 'Mark With A K', discogsId: 111419 },
      { name: 'MC Chucky', note: 'Belgian hardstyle MC, not a producer. No Discogs page.' },
    ],
  },
  {
    compositeName: 'SHDW b2b ÜBERKIKZ',
    splitArtists: [
      { name: 'SHDW', discogsId: 4507074 },
      { name: 'ÜBERKIKZ', note: 'Techno DJ affiliated with BCCO Berlin. No Discogs artist page. RA: ra.co/dj/uberkikz' },
    ],
  },
  {
    compositeName: 'Alycia Bezgo b2b Portex',
    splitArtists: [
      { name: 'Alycia Bezgo', note: 'Belgian DJ' },
      { name: 'Portex', note: 'Belgian DJ' },
    ],
  },
  {
    compositeName: '5NAPBACK b2b Karakals',
    splitArtists: [
      { name: '5NAPBACK', note: 'Belgian DJ' },
      { name: 'Karakals', note: 'Belgian DJ' },
    ],
  },
  {
    compositeName: 'David Löhlein F2F Yasmin regisford',
    splitArtists: [
      { name: 'David Löhlein', note: 'German techno producer. Discogs releases: Seyla EP, VISION I' },
      { name: 'Yasmin Regisford', note: 'Needs research' },
    ],
  },
  {
    compositeName: 'Adrián Mills F2F SISU',
    splitArtists: [
      { name: 'Adrián Mills', note: 'Spanish-born techno DJ based in Germany. Founder of 240 KM/H label. No Discogs.' },
      { name: 'SISU', note: 'Could refer to SISU collective (Leeds) or SISU label (Germany). Needs clarification.' },
    ],
  },
];

// ========== 无法映射的艺人 (无 Discogs 页面) ==========

const UNMAPPABLE = [
  {
    lineupName: 'Pretty Girls Like Trap Music Soundsystem (Imani & Claire Lyons)',
    reason: 'Dutch women+ hip-hop collective/soundsystem, not individual producers. Imani & Claire Lyons are DJs hosting club nights in Amsterdam/Rotterdam. No individual Discogs pages.',
  },
  {
    lineupName: 'Ballantine & Dieux Père',
    reason: '无法找到任何相关信息。可能是非常小众的比利时本地艺人。',
  },
  {
    lineupName: 'HALŌ',
    reason: 'Progressive house supergroup formed by Third Party + DubVision + Matisse & Sadko. New collaborative project, likely no dedicated Discogs entry yet.',
  },
  {
    lineupName: 'Diètro',
    reason: 'Belgian electronic/dance DJ. Has Beatport page, no Discogs found. Notable tracks: "Arabian Nights" (with Bassjackers), "Slaves" (with Wolfpack).',
  },
];

// ========== 主函数 ==========

function normKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log('✅ 已连接 MongoDB\n');

  const collection = db.collection('dj_discogs_map');

  // ─── 1. 应用已确认的 Discogs 映射 ───
  console.log('─── 应用 Discogs 映射 ───\n');

  let appliedCount = 0;
  for (const m of FOUND_MAPPINGS) {
    const key = normKey(m.lineupName);

    if (m.discogsId > 0) {
      // 有确切 Discogs ID
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
          $setOnInsert: {
            lineupNameKey: key,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log(`  ✅ 新增: ${m.lineupName} → discogs:${m.discogsId} (${m.discogsName})`);
      } else if (result.modifiedCount > 0) {
        console.log(`  📝 更新: ${m.lineupName} → discogs:${m.discogsId} (${m.discogsName})`);
      } else {
        console.log(`  ⏭️  已存在: ${m.lineupName}`);
      }
      appliedCount++;
    } else {
      // 有待确认 Discogs ID 的
      console.log(`  ⚠️  待确认: ${m.lineupName} — ${m.note || '需要手动查找 Discogs artist ID'}`);
      // 依然写入基本信息
      await collection.updateOne(
        { lineupNameKey: key },
        {
          $set: {
            lineupName: m.lineupName,
            displayGenres: m.displayGenres,
            displayStyles: m.displayStyles,
            status: 'pending_review',
            reviewReason: m.note || 'Discogs artist ID 待手动确认',
            source: 'web-research',
          },
          $setOnInsert: {
            lineupNameKey: key,
          },
        },
        { upsert: true }
      );
    }
  }

  // ─── 2. 处理无法映射的艺人 ───
  console.log('\n─── 无法映射的艺人 ───\n');
  for (const u of UNMAPPABLE) {
    const key = normKey(u.lineupName);
    await collection.updateOne(
      { lineupNameKey: key },
      {
        $set: {
          lineupName: u.lineupName,
          status: 'pending_review',
          reviewReason: `[Web Research] ${u.reason}`,
          source: 'web-research',
        },
        $setOnInsert: {
          lineupNameKey: key,
        },
      },
      { upsert: true }
    );
    console.log(`  🔴 ${u.lineupName}: ${u.reason}`);
  }

  // ─── 3. B2B 组合信息 ───
  console.log('\n─── B2B/F2F 组合 (需执行 split-pending-lineup) ───\n');
  for (const b of B2B_TO_SPLIT) {
    const key = normKey(b.compositeName);
    const members = b.splitArtists.map(a =>
      `${a.name}${a.discogsId ? ` (discogs:${a.discogsId})` : ''}${a.note ? ` — ${a.note}` : ''}`
    ).join('\n    ');
    console.log(`  🔀 ${b.compositeName}:`);
    console.log(`    ${members}`);

    // 更新 composite 条目的 review reason
    await collection.updateOne(
      { lineupNameKey: key },
      {
        $set: {
          lineupName: b.compositeName,
          status: 'pending_review',
          reviewReason: `B2B/F2F combination — needs to be split into individual artists via db:split-pending-lineup`,
          source: 'web-research',
        },
        $setOnInsert: {
          lineupNameKey: key,
        },
      },
      { upsert: true }
    );
  }

  // ─── 4. 输出统计 ───
  console.log('\n─── 统计 ───');
  console.log(`   已确认 Discogs 映射: ${appliedCount}`);
  console.log(`   待确认 Discogs ID: ${FOUND_MAPPINGS.filter(m => m.discogsId === 0).length}`);
  console.log(`   无法映射: ${UNMAPPABLE.length}`);
  console.log(`   B2B 组合: ${B2B_TO_SPLIT.length}`);

  await mongoose.disconnect();
  console.log('\n✅ 完成\n');
  console.log('建议后续步骤:');
  console.log('  1. cd sync-app-backend && npm run db:split-pending-lineup  # 拆分 B2B 组合');
  console.log('  2. cd hermes-agent && npm run v5:tml-belgium  # 运行 v5 pipeline');
  console.log('  3. 手动在 Discogs 上查找上述 "待确认" 艺人的 artist ID');
}

main().catch(err => { console.error('失败:', err); process.exit(1); });
