/**
 * 综合联网搜索结果 — 批量更新 TML Belgium 待审核艺人
 * 分类: 真实艺人 / Soundsystem / F2F组合 / 活动名 / 无法确认
 * 用法: cd sync-app-backend && node scripts/apply-web-research-final.cjs
 */

const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';

function normKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ===== 分类1: 确认真实艺人 (有线上资料，但无 Discogs) =====
const REAL_ARTISTS = [
  { name: 'Lerato Tsotetsi', genres: ['Afrohouse', 'Amapiano', 'Afrotech'], country: 'South Africa',
    summary: 'Johannesburg-born, Amsterdam-based DJ. Resident on Oroko Radio with bi-monthly show "Ka Lerato la Love". Played ADE, Paradiso, Amsterdam Open Air. RA: ra.co/dj/leratotsotetsi' },
  { name: 'Marwan Dua', genres: ['Deep House', 'Tech House'], country: 'Romania',
    summary: 'Romanian DJ. Performed at UNTOLD Festival (Galaxy & Daydreaming stages). Style spans deep house, tech house, and techno.' },
  { name: 'Cici Daze', genres: ['Deep Tech', 'Minimal House', 'Tech House'], country: 'Netherlands',
    summary: 'House DJ from Eindhoven, Netherlands. Already played Tomorrowland, Thuishaven, Solar, Loveland, Complex Festival. Known for groovy deep-tech with driving basslines.' },
  { name: 'Rockefellababe', genres: ['Dancehall', 'Reggae', 'Afrobeat'], country: 'Netherlands',
    summary: 'Amsterdam-based DJ. Founder of "Fidigyaldem" movement. Played Mysteryland, Milkshake Festival, ADE. Has original releases: "Badgyal", "Energy", "Backshot".' },
  { name: 'Nastya Dikikh', genres: ['Techno'], country: 'Belgium',
    summary: 'Belgian techno DJ. Started DJing in Sydney, now based in Brussels. Supported 999999999, Charlie Sparks, Rebekah. Played C12 Brussels, BASIS, Ampere Antwerp.' },
  { name: 'Wilbert Pigmans', genres: ['NL Pop', 'Party'], country: 'Netherlands',
    summary: 'Dutch party/pop music artist. Notable tracks: "De Toreador" (with Opgeblazen), "Raven Is Leven" (with DJ Zany). Played Emporium, Dreamfields, Decibel Outdoor.' },
  { name: 'Karakals', genres: ['Electronic', 'Drum & Bass', 'Dance'], country: 'Belgium',
    summary: 'Belgian DJ from Antwerp. Booked by Platform Agency. Played Tomorrowland (Library Stage), Tomorrowland Winter, Rock Werchter, Ostend Beach. Track: "My Heart" (2026).' },
  { name: 'MELV!EE', genres: ['Eclectic', 'House'], country: 'Netherlands',
    summary: 'Amsterdam-born DJ. Performed at Trix (Belgium). Featured on The NEXT Podcast S3E6. Known for eclectic, high-energy party sets.' },
  { name: 'Sebsky', genres: ['Electronic'], country: 'Belgium',
    summary: '14-year-old Belgian DJ talent. Selected by Tomorrowland Academy for Tomorrowland 2025 (Rise Stage). Also playing Retro Classics XXL and Vijverfestival 2026.' },
  { name: 'Sef sansT', genres: ['Electronic'], country: 'Belgium',
    summary: '17-year-old Antwerp DJ (real name: Sef Daponte). Father is a DJ for Redbeats. Semi-finalist MNM Start To DJ 2023. Performed for RAFC at Bosuil stadium.' },
  { name: 'Delafino', genres: ['House', 'Soulful House', 'Funky House'], country: 'Belgium',
    summary: 'Veteran Belgian house DJ (Philip Delafino, ~54) from Antwerp. Started DJing at 17. Residencies: Versuz, Hed Kandi, Defected in the House. Has own stage concept at Tomorrowland.' },
  { name: 'Tania Moon', genres: ['Deep House', 'Techno', 'Progressive House', 'Afro House'], country: 'Spain',
    summary: 'Spanish DJ from Valencia, based in Ibiza since 2011. Former Pacha Ibiza & Lío Ibiza resident. Currently resident at Sa Trinxa. Host on Ibiza Global Radio.' },
  { name: 'NORO$T', genres: ['Techno', 'Latin Electronic', 'Guaracha'], country: 'Colombia',
    summary: 'Colombian producer duo from Bogotá. Blend techno with Latin rhythms at 150-165 BPM. Label: Headroom Records. TikTok ~98k followers. Founders of "Nasty Club" movement.' },
  { name: 'Christian82', genres: ['Deep House', 'Afro-House', 'Tech-House'], country: 'Belgium',
    summary: 'Belgian house DJ from Antwerp. 10+ year career. Played Tomorrowland, Extrema Outdoor, WECANDANCE, Ostend Beach Festival, Mirador. Known for "sweet, mellow music" style.' },
  { name: 'Milinguap', genres: ['Afrobeats', 'Afrohouse', 'Dancehall'], country: 'Belgium',
    summary: 'Belgium-based DJ specializing in Afro-Caribbean music. Played Tomorrowland, Reggae Geel, Couleur Cafe, Bomboclat Festival. Booked by Kurious agency.' },
  { name: 'Heaven Sam', genres: ['Afrobeat', 'Electronic', 'Soul', 'Funk'], country: 'Côte d\'Ivoire',
    summary: 'Ivorian/French producer, songwriter, and multi-instrumentalist. Stepped into spotlight in 2021. Album "Hybride" with DJ Kawest. Featured on BBC Radio 1Xtra. Played Couleur Café 2025.' },
  { name: 'Fonsi Nieto', genres: ['House'], country: 'Spain',
    summary: 'Spanish DJ and former MotoGP racer. Debut album "Ten" (2018) on Clipper\'s Sounds, dedicated to his uncle Ángel Nieto. 16+ releases on Qobuz.' },
  { name: 'Lucca Van Damme', genres: ['House', 'Electronic'], country: 'Belgium',
    summary: 'Belgian DJ/producer signed to Smash The House (Dimitri Vegas & Like Mike\'s label). Tomorrowland Academy success story.' },
  { name: 'BYØRN', genres: ['Hard Techno', 'Hard Dance', 'Neo Rave'], country: 'Belgium',
    summary: 'Belgian hard techno DJ (Bjorn Verbeeck) from Antwerp. Beatport\'s best-selling hard techno artist 2024. 20M+ streams. Releases on Exhale (Amelie Lens), No Mercy. RA: ra.co/dj/byorn' },
];

// ===== 分类2: Soundsystem/Collective (非个人艺人) =====
const SOUNDSYSTEMS = [
  { name: 'Vunzige Deuntjes Soundsystem', note: 'Dutch "Dirty Tunes" DJ collective. Plays Tomorrowland Elixir stage with MCs Eddiethehost & MC Claudio. Urban/global bass music. Part of larger Vunzige Deuntjes brand/platform.' },
  { name: 'Afrolosjes Soundsystem', note: 'Belgian local soundsystem. No online presence found. Likely a small collective playing local stages.' },
  { name: 'Encore Soundsystem', note: 'Belgian local soundsystem. No clear online presence found.' },
  { name: 'Steww Soundsystem', note: 'Belgian local soundsystem. No online presence found.' },
  { name: 'Panda Sound System', note: 'Belgian local soundsystem. No online presence found.' },
  { name: 'Favella Som Sistema', note: 'Probably a Belgian collective. Name references "Favela Sound System" (Portuguese). No clear online presence.' },
];

// ===== 分类3: 可能的非艺人名称 (活动名/舞台名/不确定) =====
const NON_ARTISTS = [
  { name: 'NO SURPRISE', note: '找不到对应艺人信息。可能不是艺人名，而是 Tomorrowland 某个活动/舞台概念。' },
  { name: 'Not My Type', note: '找到相似名 NOTMYTYPE (与 Nicolas Julian 合作过)。如果是同一人则为真实艺人，否则可能为活动名。需确认。' },
  { name: 'Effe Serieus', note: '荷兰语意为"认真的/严肃的"。找不到对应艺人。可能是比利时本地活动品牌名而非艺人名。' },
  { name: 'Los Bomberos', note: '西班牙语"消防员"。找不到对应艺人。可能是活动名、舞台名或本地派对品牌。' },
  { name: 'CVNTS', note: '找不到对应艺人。可能是 stylized artist name 或活动名。' },
  { name: 'Monsieur', note: '找不到确切对应艺人。Discogs 上有多个 "Monsieur" 相关条目但无法确认哪一个。可能是比利时本地 DJ。' },
  { name: 'The Z.', note: '名字过于简短模糊，无法确认身份。可能是比利时本地 DJ 的艺名。' },
  { name: 'ARTEN', note: 'ADE (Amsterdam Dance Event) 上有 listing。可能是荷兰/比利时电子音乐人，但信息有限。' },
];

// ===== 分类4: F2F 组合 (需要拆分) =====
const F2F_COMBOS = [
  { name: 'EMILIJA F2F Frederic.', members: ['EMILIJA', 'Frederic.'] },
  { name: 'FUMI F2F HUJUS', members: ['FUMI', 'HUJUS'] },
  { name: 'Hurts F2F ROW 1', members: ['Hurts', 'ROW 1'] },
  { name: 'Klaps F2F Miamor', members: ['Klaps', 'Miamor'] },
  { name: 'Serafina F2F zwilling', members: ['Serafina', 'zwilling'] },
];

// ===== 分类5: 完全找不到的艺人 =====
const NOT_FOUND = [
  'Sacha Malice', 'Aghatixx', 'Bosart', 'Cyborg-18',
  'Dries Smet', 'Jeroen Visser', 'Just-K', 'Le Windey',
  'Massignan.y', 'Mitched', 'MAE.LIE', 'Anton Invicta',
  'Dave Hang', 'DJ FASTA', 'Foxed Up',
];

// ===== 分类6: 已识别的名字变体/格式问题 =====
const NAME_VARIANTS = [
  { current: 'YERUN', suggested: 'Yeröm', note: 'Belgian melodic techno DJ from Ghent. Releases on Beatfreak, ICONYC Noir. beatport.com/artist/yerom/609284' },
  { current: 'Sacha Malice', suggested: '(待确认)', note: '可能是 Sacha (比利时 techno DJ) 的变体或新人。建议检查 Tomorrowland 官方阵容页面确认。' },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('dj_discogs_map');
  console.log('✅ 已连接 MongoDB\n');

  let updated = 0, systems = 0, nonArtist = 0, f2f = 0, notFound = 0, variants = 0;

  // 1. 真实艺人
  console.log('─── 真实艺人 (更新流派+简介) ───\n');
  for (const a of REAL_ARTISTS) {
    const key = normKey(a.name);
    await collection.updateOne(
      { lineupNameKey: key },
      { $set: {
          lineupName: a.name,
          displayGenres: a.genres,
          status: 'mapped',
          reviewReason: `[Web Research] ${a.summary}`,
          source: 'web-research',
        },
        $setOnInsert: { lineupNameKey: key },
      },
      { upsert: true }
    );
    console.log(`  ✅ ${a.name} — ${a.genres.slice(0,3).join(', ')} (${a.country})`);
    updated++;
  }

  // 2. Soundsystem
  console.log('\n─── Soundsystem/Collective (非个人艺人) ───\n');
  for (const s of SOUNDSYSTEMS) {
    const key = normKey(s.name);
    await collection.updateOne(
      { lineupNameKey: key },
      { $set: {
          lineupName: s.name,
          status: 'pending_review',
          reviewReason: `[Web Research] Soundsystem/Collective — 非个人艺人。${s.note}`,
          source: 'web-research',
        },
        $setOnInsert: { lineupNameKey: key },
      },
      { upsert: true }
    );
    console.log(`  🔊 ${s.name}`);
    systems++;
  }

  // 3. 可能的非艺人
  console.log('\n─── 可能的非艺人名称 ───\n');
  for (const n of NON_ARTISTS) {
    const key = normKey(n.name);
    await collection.updateOne(
      { lineupNameKey: key },
      { $set: {
          lineupName: n.name,
          status: 'pending_review',
          reviewReason: `[Web Research] ${n.note}`,
          source: 'web-research',
        },
        $setOnInsert: { lineupNameKey: key },
      },
      { upsert: true }
    );
    console.log(`  ❓ ${n.name}: ${n.note}`);
    nonArtist++;
  }

  // 4. F2F 组合
  console.log('\n─── F2F 组合 ───\n');
  for (const f of F2F_COMBOS) {
    const key = normKey(f.name);
    await collection.updateOne(
      { lineupNameKey: key },
      { $set: {
          lineupName: f.name,
          status: 'pending_review',
          reviewReason: `[Web Research] F2F combination — needs splitting into: ${f.members.join(', ')}`,
          source: 'web-research',
        },
        $setOnInsert: { lineupNameKey: key },
      },
      { upsert: true }
    );
    console.log(`  🔀 ${f.name} → ${f.members.join(' + ')}`);
    f2f++;
  }

  // 5. 完全找不到
  console.log('\n─── 完全找不到 ───\n');
  for (const name of NOT_FOUND) {
    const key = normKey(name);
    await collection.updateOne(
      { lineupNameKey: key },
      { $set: {
          lineupName: name,
          status: 'pending_review',
          reviewReason: '[Web Research] 联网搜索未找到对应艺人信息。可能是比利时本地小众 DJ、新人、或活动名。',
          source: 'web-research',
        },
        $setOnInsert: { lineupNameKey: key },
      },
      { upsert: true }
    );
    notFound++;
  }
  console.log(`  🔴 ${NOT_FOUND.length} 人无法确认`);

  // 6. 名字变体
  console.log('\n─── 名字变体/格式建议 ───\n');
  for (const v of NAME_VARIANTS) {
    console.log(`  🔧 ${v.current} → 可能是 "${v.suggested}": ${v.note}`);
    variants++;
  }

  // ===== 汇总 =====
  console.log('\n═══════════════════════════════════');
  console.log('           更新汇总               ');
  console.log('═══════════════════════════════════\n');
  console.log(`  ✅ 真实艺人 (已更新):     ${updated}`);
  console.log(`  🔊 Soundsystem/Collective: ${systems}`);
  console.log(`  ❓ 可能的非艺人:          ${nonArtist}`);
  console.log(`  🔀 F2F 组合:             ${f2f}`);
  console.log(`  🔴 完全找不到:           ${notFound}`);
  console.log(`  🔧 名字变体建议:          ${variants}`);
  console.log(`  ─────────────────────────`);
  console.log(`  📊 合计:                 ${updated + systems + nonArtist + f2f + notFound}`);

  // 最终统计
  const perfs = await db.collection('artist_performances').find({ activityLegacyId: 7 }).toArray();
  const artistMap = new Map();
  for (const p of perfs) {
    const k = normKey(p.artistName);
    if (!artistMap.has(k)) artistMap.set(k, p);
  }
  const allMaps = await db.collection('dj_discogs_map').find({}).toArray();
  const mapByKey = new Map(allMaps.map(d => [d.lineupNameKey, d]));
  let mapped = 0, pending = 0, unmapped = 0;
  for (const [key] of artistMap) {
    const map = mapByKey.get(key);
    if (!map) unmapped++;
    else if (map.status === 'mapped') mapped++;
    else pending++;
  }

  console.log(`\n📈 TML Belgium 最终状态:`);
  console.log(`   ✅ 已映射: ${mapped}/${artistMap.size} (${(mapped/artistMap.size*100).toFixed(1)}%)`);
  console.log(`   ⚠️  待审核: ${pending} (${(pending/artistMap.size*100).toFixed(1)}%)`);
  console.log(`   ❌ 无映射: ${unmapped} (${(unmapped/artistMap.size*100).toFixed(1)}%)`);

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}

main().catch(err => { console.error('失败:', err); process.exit(1); });
