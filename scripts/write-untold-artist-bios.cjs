/**
 * 将 UNTOLD Romania 2026 艺人 Bio 写入 djs 表 + 关联 dj_discogs_map
 * 用法: cd sync-app-backend && node scripts/write-untold-artist-bios.cjs
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sync-ai';
let nextSyntheticId = 1000000029;

function normKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const UNTOLD_ARTIST_BIOS = [
  {
    name: 'ALBERT NBN',
    discogsId: 0,
    realName: '',
    country: 'Romania',
    genres: ['Trap', 'Hip-Hop'],
    profile:
      'Albert NBN is a new wave Romanian trap artist. He quickly gained attention through collaborations with artists like Rava and IDK. His style blends emotion, modern influences, and authentic urban aesthetics.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'APE CHIMBA',
    discogsId: 12545933,
    realName: '',
    country: 'Spain',
    genres: ['Afro House', 'World Music', 'Electronic'],
    profile:
      "Ape Chimba's DJ sets blend Afro-electronic sounds with traditional African rhythms and modern electronic production. His performances create an immersive experience where ancestral heritage meets contemporary innovation, guiding audiences through a dynamic journey that connects primal energy with futuristic sonic landscapes.",
    urls: ['https://www.discogs.com/artist/12545933-Ape-Chimba', 'https://untold.com/artists'],
  },
  {
    name: 'BERECHET',
    discogsId: 0,
    realName: '',
    country: 'Romania',
    genres: ['Hip-Hop', 'Trap'],
    profile: 'BERECHET urcă pe scena UNTOLD ONE.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'CANCELLED MUSIC (KRIS FADE & DEAN CURTIS)',
    discogsId: 0,
    realName: 'Kris Fade & Dean Curtis',
    country: 'UAE',
    genres: ['EDM', 'Techno', 'Electronic'],
    profile:
      'Cancelled Music is an electronic project from Dubai, created by Kris Fade and DJ Dean Curtis. With a sonic direction built around club energy, techno influences, and the spirit of festival-driven EDM, the duo turns each appearance into an intense moment, directly connected to the crowd. Through dynamic sets, atmosphere-focused selections, and an increasingly visible presence within the region\'s electronic music scene, Cancelled Music brings to the stage the energy of a new generation of artists connected to global festival culture.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'EVA NICOLESCU',
    discogsId: 0,
    realName: 'Eva Nicolescu',
    country: 'Romania',
    genres: ['Pop', 'R&B', 'Soul'],
    profile:
      'Eva Nicolescu is a singer and songwriter with a powerful, clear, and expressive voice, capable of conveying emotion in a direct and authentic way. Her vocal tone blends sensitivity with strength, without ever losing depth. Her energy is magnetic — not just about intensity, but about presence. She is defined by a romantic, mature, and expressive style, built around a voice that carries both impact and elegance.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'ALEX VELEA & MADATORICELLI',
    discogsId: 0,
    realName: 'Alex Velea & Madatoricelli',
    country: 'Romania',
    genres: ['Pop', 'Hip-Hop', 'R&B'],
    profile:
      'Alex Velea and Madatoricelli bring together two complementary sides of Romania\'s urban music scene, from the pop, R&B and hip-hop sound that shaped an important part of the 2000s and 2010s, to the fresh energy of a new generation. Alex Velea remains one of the most recognizable Romanian artists, known for tracks such as "Minim doi" and "Din vina ta," major collaborations, and a live presence built on charisma, rhythm, and a strong connection with the audience. Alongside him, Madatoricelli brings a current urban style, closely connected to the younger audience, completing the moment with a direct, energetic, and relevant sound for today\'s music scene.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'DELIRIC X SILENT STRIKE X MUSE ORCHESTRA',
    discogsId: 0,
    realName: 'Deliric & Silent Strike',
    country: 'Romania',
    genres: ['Hip-Hop', 'Orchestral', 'Live'],
    profile:
      'Deliric is one of Romania\'s Hip Hop scene pioneers. He\'s continuously evolving since 1999, and he started his career as a street MC, influenced by the urban culture and current socio-political realities. An important pillar for the Romanian artist, is his collaboration with the producer Silent Strike, alongside which he experimented a new side of rap music. Therefore, the three Deliric X Silent Strike albums came to life, a trilogy brought to stage alongside Muse Quartet Orchestra.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'PENDULUM DJ SET',
    discogsId: 63252,
    realName: 'Pendulum',
    country: 'Australia',
    genres: ['Drum & Bass', 'Electronic Rock', 'Bass Music'],
    profile:
      'Pendulum is one of the most influential acts in the drum & bass and electronic rock space, playing a major role in bringing the genre to a global audience. Founded in 2002 in Perth, Australia, the group built a distinctive sound that blends the energy of bass music with rock elements, large-scale production, and the intensity of live performance. Through albums such as Hold Your Colour, In Silico, and Immersion, Pendulum cemented their status as a defining force in contemporary electronic music, recognized for their ability to unite the power of the drum & bass scene with the scale of a live band.',
    urls: ['https://www.discogs.com/artist/63252-Pendulum', 'https://untold.com/artists'],
  },
  {
    name: 'PETRE ȘTEFAN',
    discogsId: 0,
    realName: 'Petre Ștefan',
    country: 'Romania',
    genres: ['Trap', 'Pop', 'Soul', 'Alternative'],
    profile:
      'Petre Ștefan is a Romanian artist blending trap with pop, soul, and alternative influences. Known for his distinct voice and emotional songwriting, he has collaborated with Oscar, Amuly, and Azteca. He brings a fresh touch to the local urban music scene.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'ȘAGUNA',
    discogsId: 14196916,
    realName: 'Adrian Saguna',
    country: 'Romania',
    genres: ['House', 'Progressive House', 'Electronic'],
    profile:
      "Șaguna's sets combine high-energy grooves with a modern, distinctive touch, earning him a reputation for delivering memorable experiences at major festivals and clubs across Romania and beyond. As a producer, he is steadily building a dynamic catalog, with releases on respected labels such as GODEEVA, Dancefy Records, and other forward-thinking imprints.",
    urls: ['https://www.discogs.com/artist/14196916-Adrian-Saguna', 'https://untold.com/artists'],
  },
  {
    name: 'VLAD FLUERARU & DJ NASA',
    discogsId: 0,
    realName: 'Vlad Flueraru & DJ NASA',
    country: 'Romania',
    genres: ['Hip-Hop', 'Rap'],
    profile:
      'Vlad Flueraru & DJ NASA bring together the energy of contemporary Romanian hip-hop in a format built around lyrics, music selection, and a direct connection with the audience. Vlad Flueraru has stood out through a sincere and modern approach to rap, while DJ NASA has built his path as a DJ, producer, and member of the Facem Records scene. Together, they create a live act with strong roots in hip-hop culture, where flow, beats, and club atmosphere come together in a dynamic and authentic show.',
    urls: ['https://untold.com/artists'],
  },
  {
    name: 'WHOMADEWHO HYBRYD DJ SET',
    discogsId: 415893,
    realName: 'Tomas Høffding, Tomas Barfod & Jeppe Kjellberg',
    country: 'Denmark',
    genres: ['Electronic', 'Indie Dance', 'Alternative'],
    profile:
      'WhoMadeWho is one of the most acclaimed Danish acts in the alternative electronic music space. Formed in Copenhagen in 2003, the trio composed of Tomas Høffding, Tomas Barfod, and Jeppe Kjellberg has built a distinctive sonic identity at the intersection of electronic music, indie sensibility, and organic live instrumentation. Over the years, WhoMadeWho has stood out through the emotional depth of their songwriting, their openness to experimentation, and their ability to turn melodic sensitivity into highly impactful live performances, further cementing their status as a defining force in the contemporary alternative electronic scene.',
    urls: ['https://www.discogs.com/artist/415893-WhoMadeWho', 'https://untold.com/artists'],
  },
  {
    name: 'YNY SEBI',
    discogsId: 0,
    realName: '',
    country: 'Romania',
    genres: ['Trap', 'Hip-Hop', 'Rap'],
    profile:
      'YNY Sebi is one of the visible names of Romania\'s new generation of trap and rap artists. With a direct style, closely connected to urban culture and the language of young audiences, he has gradually built a recognizable identity within the local scene. Projects such as Most Wanted and collaborations with artists from the urban music space have contributed to his growing visibility, strengthening his place within the new wave of Romanian music. Through energy, attitude, and a natural connection with his audience, YNY Sebi continues to be a relevant presence in Romania\'s trap scene.',
    urls: ['https://untold.com/artists'],
  },
];

async function upsertDj(djsCollection, artist, discogsId) {
  const existing = await djsCollection.findOne({ discogsId });
  const doc = {
    discogsId,
    name: artist.name,
    realName: artist.realName || artist.name,
    profile: artist.profile,
    country: artist.country,
    genres: artist.genres,
    styles: artist.genres,
    urls: artist.urls,
    crawledAt: new Date(),
    source: 'untold-official-bio',
  };

  if (existing) {
    await djsCollection.updateOne({ discogsId }, { $set: doc });
    return existing.profile?.length > 50 ? 'updated' : 'updated';
  }

  await djsCollection.insertOne(doc);
  return 'created';
}

async function upsertMap(mapCollection, artist, discogsId) {
  const key = normKey(artist.name);
  await mapCollection.updateOne(
    { lineupNameKey: key },
    {
      $set: {
        discogsId,
        discogsName: artist.realName || artist.name,
        status: 'mapped',
        displayGenres: artist.genres,
        source: 'untold-official-bio',
        mappedAt: new Date(),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        lineupName: artist.name,
        lineupNameKey: key,
      },
    },
    { upsert: true },
  );
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const djsCollection = db.collection('djs');
  const mapCollection = db.collection('dj_discogs_map');
  console.log('✅ 已连接 MongoDB\n');

  let created = 0;
  let updated = 0;

  for (const artist of UNTOLD_ARTIST_BIOS) {
    let discogsId = artist.discogsId;
    if (discogsId === 0) {
      discogsId = nextSyntheticId++;
    }

    const result = await upsertDj(djsCollection, artist, discogsId);
    if (result === 'created') {
      created += 1;
      console.log(`  ✅ 创建 djs: ${artist.name} (discogs:${discogsId})`);
    } else {
      updated += 1;
      console.log(`  📝 更新 djs: ${artist.name} (discogs:${discogsId})`);
    }

    await upsertMap(mapCollection, artist, discogsId);
  }

  const perfs = await db
    .collection('artist_performances')
    .find({ activityLegacyId: 9 })
    .toArray();
  const artistKeys = new Map();
  for (const perf of perfs) {
    const key = normKey(perf.artistName);
    if (!artistKeys.has(key)) artistKeys.set(key, perf.artistName);
  }

  const maps = await mapCollection.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));

  let withProfile = 0;
  for (const [key, name] of artistKeys) {
    const map = mapByKey.get(key);
    if (!map?.discogsId) continue;
    const dj = await djsCollection.findOne({ discogsId: map.discogsId });
    if (dj?.profile && dj.profile.length > 20) {
      withProfile += 1;
    } else if (UNTOLD_ARTIST_BIOS.some((a) => normKey(a.name) === key)) {
      console.log(`  ⚠️  bio 仍缺失: ${name}`);
    }
  }

  console.log('\n═══════════════════════════════════');
  console.log(`  ✅ 新建 djs: ${created}`);
  console.log(`  📝 更新 djs: ${updated}`);
  console.log(`  📊 UNTOLD 有 profile: ${withProfile}/${artistKeys.size}`);
  console.log('═══════════════════════════════════');

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}

main().catch((err) => {
  console.error('失败:', err);
  process.exit(1);
});
