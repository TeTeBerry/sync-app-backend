/**
 * 补齐组合艺人信息 — 永久 Duo + B2B/F2F 成员
 * 用法: cd sync-app-backend && node scripts/write-combo-artist-bios.cjs
 */

const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';
let nextSyntheticId = 999992000;

function normKey(n) { return (n || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// ===== 永久 Duo/Group (有 Discogs ID) =====
const DUOS_WITH_DISCOGS = [
  {
    name: "D'Angello & Francis",
    discogsId: 6121903,
    realName: 'Angelo De Laet & Cédric Franssens',
    country: 'Belgium',
    genres: ['Electro House', 'Techno', 'Future Rave', 'Dance'],
    profile: "D'Angello & Francis are a Belgian DJ/producer duo from Antwerp, consisting of Angelo De Laet and Cédric Franssens. Active for over a decade, they are part of the Smash The House family (Dimitri Vegas & Like Mike's label).\n\nTheir productions have charted on Beatport and twice in the USA Billboard rankings. In 2019, they played the Tomorrowland Mainstage with Dimitri Vegas & Like Mike and Bassjackers. They collaborated with Armin van Buuren on 'Que Pasa' (2020). Their sound focuses on Future Rave, with recent releases on Revealed Recordings (Hardwell's label).\n\nNotable tracks: 'All Aboard' (with Bassjackers), 'Que Pasa' (with Armin van Buuren), 'The Flight', 'Gold', 'Future Rave Is Now', 'Us vs Me' (2025).",
    urls: ['https://www.discogs.com/artist/6121903'],
  },
];

// ===== 永久 Duo 有 Bio 但无 Discogs ID =====
const DUOS_NO_DISCOGS = [
  {
    name: 'Block & Crown',
    realName: 'Adri Blok & Mitchel Kroon',
    country: 'Netherlands',
    genres: ['Funky House', 'Nu Disco', 'Jackin House', 'Soulful House'],
    profile: 'Block & Crown are a Dutch house music duo from Amsterdam, consisting of Adri Blok and Mitchel Kroon (also credited as Mitch Crown). They are one of the most prolific house acts with 1,000+ releases across labels including fabric Records, Milk & Sugar, Tribal Kitchen, Next-Gen-Records, and ZYX Music.\n\nTheir sound sits in the jackin\' house lane, drawing on the swing and sampling sensibilities of disco and funk-rooted dance records. They have collaborated with Roland Clark, CASSIMM, David Penn, Todd Terry, and Crazibiza. Their catalog includes hundreds of funky house/nu-disco reworks of classic tracks.',
    urls: ['https://www.beatport.com/artist/block-crown/'],
  },
  {
    name: 'Dimitri Vangelis & Wyman',
    realName: 'Dimitrios Vardalis & Andreas Wiman',
    country: 'Sweden',
    genres: ['Progressive House', 'Electro House'],
    profile: 'Dimitri Vangelis & Wyman is a Swedish DJ/production duo from Stockholm, consisting of Dimitrios Vardalis and Andreas Wiman. Active since 2011, they are closely associated with Steve Angello\'s Size Records.\n\nTheir breakthrough track "Payback" was a collaboration with Steve Angello (2014). Other notable releases include "ID2" and "Rebel" (with AN21) on Size Records, and "Daylight" with Yves V on Spinnin\' Records. They founded their own label Buce Records in 2015, releasing progressive house, electro house, and big room. Their track "Zonk" and remixes have been supported by major DJs worldwide.',
    urls: ['https://www.discogs.com/release/6282561'],
  },
  {
    name: 'Bobby & Djenko',
    realName: '',
    country: 'Belgium',
    genres: ['House', 'Tech House', 'Minimal'],
    profile: 'Bobby & Djenko are a Belgian DJ/producer duo from Antwerp. They release on the Flipsight label with their "Funky Dancer EP" (2025). Their sound spans house, tech house, and minimal. They are regulars in the Antwerp club circuit, performing at venues like Full Circle Antwerp.',
    urls: ['https://www.beatport.com/artist/bobby-djenko/1107925', 'https://www.djguide.nl/djinfo.p?djid=10063'],
  },
  {
    name: 'Omdat Het Kan & Average Rob',
    realName: 'Robert Van Impe (Average Rob)',
    country: 'Belgium',
    genres: ['Party', 'Hardstyle', 'Drum & Bass', 'Techno'],
    profile: 'Omdat Het Kan & Average Rob are a high-energy Belgian DJ/MC duo. Average Rob (Robert Van Impe, born 1992 in Overijse) is a well-known Belgian comedian, YouTuber, and radio host (BOITLYFE on Studio Brussel). "Omdat Het Kan" (Dutch for "Because It Can") is the DJ/producer half of the duo.\n\nTogether, they deliver a chaotic mix of nostalgic classics, pop hits, drum & bass, hardstyle, and techno. Their viral summer anthem "On Met La Patate" (2024) won Song of the Year at the Ketnet Gouden K\'s. They have performed on the Tomorrowland Mainstage (Weekend 1, 2024 and 2025). Described as "the ultimate Belgian cocktail of chaos, energy, and ultra-hard beats."',
    urls: ['https://kurious.be/artist/omdat-het-kan-average-rob/', 'https://www.last.fm/music/Average+Rob/+wiki'],
  },
  {
    name: 'Luna & Lenthe',
    realName: '',
    country: 'Belgium',
    genres: ['House', 'Afro House'],
    profile: 'Luna & Lenthe are a Belgian DJ sister duo. They have performed at venues including Bolivar Beach Bar and are associated with the Afro house scene. Limited online presence suggests they are an emerging act in the Belgian club circuit.',
    urls: [],
  },
  {
    name: 'Brits & Boen',
    realName: '',
    country: 'Belgium',
    genres: ['Electronic'],
    profile: 'Brits & Boen are a Belgian DJ duo. Limited online presence suggests they are emerging local artists in the Belgian electronic music scene.',
    urls: [],
  },
  {
    name: 'Sojuju & Julian Jermain',
    realName: '',
    country: 'Belgium',
    genres: ['Electronic'],
    profile: 'Sojuju & Julian Jermain are a Belgian DJ duo. They have performed at By The Creek festival (2018) and appear on When.fm for event lineups. Part of the Belgian local electronic scene.',
    urls: ['https://when.fm/artists/121442/sojuju%20%26%20Julian%20Jermain'],
  },
  {
    name: 'Marvin & Cameron',
    realName: '',
    country: 'Belgium',
    genres: ['Electronic'],
    profile: 'Marvin & Cameron are a Belgian DJ duo. Limited information available online — they appear to be emerging local artists in the Belgian electronic music scene.',
    urls: [],
  },
  {
    name: 'Lordesius & Anders',
    realName: '',
    country: 'Belgium',
    genres: ['Electronic'],
    profile: 'Lordesius & Anders are a Belgian DJ duo. Part of the local Belgian electronic music scene with limited online presence.',
    urls: [],
  },
];

// ===== 独立 B2B/F2F 成员 (已在库里但需要独立条目) =====
const B2B_MEMBERS = [
  {
    name: 'ÜBERKIKZ',
    realName: '',
    country: 'Germany',
    genres: ['Techno', 'Peak Time Techno', 'Driving Techno'],
    profile: 'ÜBERKIKZ is a techno DJ whose sets combine driving kicks, tooly synths, and tribal/folkloric elements into hypnotic journeys. She is affiliated with BCCO (Berlin-based label/collective) and publicly positions herself against sexism, discrimination, and racism, actively supporting FLINTA* artists.\n\nShe curated the BCCOVA12 compilation (2024) on BCCO — a 20-track Peak Time/Driving Techno VA. She has performed at Awakenings Upclose 2025, BCCO Berlin x Dirty Fika Malmö Showcase, and Hacked x BCCO events. SoundCloud: soundcloud.com/uberkikz, RA: ra.co/dj/uberkikz',
    urls: ['https://ra.co/dj/uberkikz', 'https://soundcloud.com/uberkikz'],
  },
  {
    name: 'Adrián Mills',
    realName: '',
    country: 'Spain',
    genres: ['Techno', 'Hard Techno', 'Acid'],
    profile: 'Adrián Mills is a Spanish-born techno DJ/producer based in Pforzheim, Germany. He started playing violin at age 6 and discovered techno at 16. His sound blends early hardstyle/hardcore influences with acid, hard techno, makina rhythms, trance basslines, and Latin energy.\n\nHe made his name in the German illegal rave scene, became a resident at Gotec Club (Karlsruhe), and co-founded the underground event series Xpand and the label/collective 240 KM/H. He is also part of the duo project 2H2G (2 High 2 Groove) with Dasstudach. Notable releases: "Ferrari F40" (Concrete Berlin), "AFTERHOURINPARIS," "Gameboy Advance."',
    urls: ['https://www.insomniac.com/music/artists/adrian-mills/', 'https://www.awakenings.com/en/artists/adrian-mills/381919/'],
  },
  {
    name: 'MC Chucky',
    realName: '',
    country: 'Belgium',
    genres: ['Hardstyle', 'Hardcore', 'Jumpstyle'],
    profile: "MC Chucky is a prominent Belgian MC (Master of Ceremonies) in the hardstyle/hardcore EDM scene, hailing from Hamme, Belgium. He is widely recognized as Belgium's #1 MC and has built a strong reputation as a vocal performer who amplifies DJ sets.\n\nHe frequently works with top hardstyle acts including Mark With a K (his longtime stage partner), Da Tweekaz, and DiMaro. He has performed at major festivals: Tomorrowland (mainstage — first harder styles act), Defqon.1 Australia, Decibel Outdoor, Reverze, The Qontinent, Parookaville, Electric Love Festival, and Timeless Festival.",
    urls: ['https://www.viberate.com/artist/mc-chucky/', 'https://mcchucky.be'],
  },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const djsColl = db.collection('djs');
  const mapColl = db.collection('dj_discogs_map');
  console.log('✅ 已连接 MongoDB\n');

  let createdDj = 0, updatedMap = 0;

  // 1. 处理有 Discogs ID 的 Duo
  console.log('─── Duo (有 Discogs ID) ───\n');
  for (const a of DUOS_WITH_DISCOGS) {
    const existing = await djsColl.findOne({ discogsId: a.discogsId });
    if (!existing) {
      await djsColl.insertOne({
        discogsId: a.discogsId, name: a.name, realName: a.realName,
        profile: a.profile, country: a.country,
        genres: a.genres, styles: a.genres, urls: a.urls,
        crawledAt: new Date(), source: 'web-research',
      });
      createdDj++;
      console.log(`  ✅ djs: ${a.name} → discogs:${a.discogsId}`);
    } else if (!existing.profile || existing.profile.length < 50) {
      await djsColl.updateOne({ discogsId: a.discogsId }, { $set: { profile: a.profile, country: a.country, genres: a.genres, urls: a.urls } });
      console.log(`  📝 更新: ${a.name}`);
    } else {
      console.log(`  ⏭️  已有: ${a.name}`);
    }
    await mapColl.updateOne({ lineupNameKey: normKey(a.name) }, { $set: { discogsId: a.discogsId, discogsName: a.name, status: 'mapped', displayGenres: a.genres, source: 'web-research' } }, { upsert: true });
    updatedMap++;
  }

  // 2. Duo 无 Discogs (synthetic ID)
  console.log('\n─── Duo (Synthetic ID) ───\n');
  for (const a of DUOS_NO_DISCOGS) {
    let id = nextSyntheticId++;
    const existing = await djsColl.findOne({ name: a.name });
    if (existing) { id = existing.discogsId; }
    if (!existing || !existing.profile || existing.profile.length < 50) {
      await djsColl.updateOne(
        { name: a.name },
        { $set: { discogsId: id, name: a.name, realName: a.realName, profile: a.profile, country: a.country, genres: a.genres, styles: a.genres, urls: a.urls, crawledAt: new Date(), source: 'web-research' } },
        { upsert: true }
      );
      createdDj++;
      console.log(`  ✅ djs: ${a.name} → discogs:${id}`);
    } else {
      console.log(`  ⏭️  已有: ${a.name}`);
    }
    await mapColl.updateOne({ lineupNameKey: normKey(a.name) }, { $set: { discogsId: id, discogsName: a.name, status: 'mapped', displayGenres: a.genres, source: 'web-research' } }, { upsert: true });
    updatedMap++;
  }

  // 3. B2B 独立成员
  console.log('\n─── B2B 独立成员 ───\n');
  for (const a of B2B_MEMBERS) {
    let id = nextSyntheticId++;
    const existing = await djsColl.findOne({ name: a.name });
    if (existing) { id = existing.discogsId; }
    if (!existing || !existing.profile || existing.profile.length < 50) {
      await djsColl.updateOne(
        { name: a.name },
        { $set: { discogsId: id, name: a.name, realName: a.realName, profile: a.profile, country: a.country, genres: a.genres, styles: a.genres, urls: a.urls, crawledAt: new Date(), source: 'web-research' } },
        { upsert: true }
      );
      createdDj++;
      console.log(`  ✅ djs: ${a.name} → discogs:${id}`);
    } else {
      console.log(`  ⏭️  已有: ${a.name}`);
    }
    await mapColl.updateOne({ lineupNameKey: normKey(a.name) }, { $set: { discogsId: id, discogsName: a.name, status: 'mapped', displayGenres: a.genres, source: 'web-research' } }, { upsert: true });
    updatedMap++;
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`  ✅ 新建/更新 djs: ${createdDj}`);
  console.log(`  🔗 更新 map 关联: ${updatedMap}`);
  console.log(`  📊 合计处理: ${DUOS_WITH_DISCOGS.length + DUOS_NO_DISCOGS.length + B2B_MEMBERS.length}`);

  // 最终统计
  const perfs = await db.collection('artist_performances').find({ activityLegacyId: 7 }).toArray();
  const am = new Map();
  for (const p of perfs) { const k = normKey(p.artistName); if (!am.has(k)) am.set(k, p); }
  const allMaps = await db.collection('dj_discogs_map').find({}).toArray();
  const mbk = new Map(allMaps.map(d => [d.lineupNameKey, d]));
  let mapped=0, withDiscogs=0, withProfile=0, pending=0, unmapped=0;
  for (const [key] of am) {
    const map = mbk.get(key);
    if (!map) { unmapped++; continue; }
    if (map.status === 'mapped') {
      mapped++;
      if (map.discogsId) { withDiscogs++;
        const dj = await djsColl.findOne({ discogsId: map.discogsId });
        if (dj?.profile?.length > 10) withProfile++;
      }
    } else pending++;
  }

  console.log(`\n📈 TML Belgium 最终:`);
  console.log(`   ✅ 已映射:     ${mapped}/${am.size} (${(mapped/am.size*100).toFixed(1)}%)`);
  console.log(`   📀 有 Discogs: ${withDiscogs}`);
  console.log(`   📝 有 Bio:     ${withProfile}`);
  console.log(`   ⚠️  待审核:     ${pending}`);
  console.log(`   ❌ 无映射:     ${unmapped}`);

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}

main().catch(err => { console.error('失败:', err); process.exit(1); });
