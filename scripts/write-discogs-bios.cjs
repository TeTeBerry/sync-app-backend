/**
 * 为有 Discogs ID 但缺 Bio 的艺人补齐英文简介
 * 用法: cd sync-app-backend && node scripts/write-discogs-bios.cjs
 */
const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';

const BIOS = [
  { name:'Ben Hemsley', discogsId:7190212, realName:'Ben Hemsley', country:'UK',
    genres:['Trance','Progressive House','House'],
    profile:"Ben Hemsley is a British DJ and producer from Newcastle, UK. A self-described 'trance kid,' he grew up immersed in the classic trance sounds of the late 90s and early 2000s. His productions blend classic trance melodies with modern house and progressive grooves, creating a nostalgic yet forward-thinking sound.\n\nHis breakthrough came with tracks like 'Bebe Mischa' and 'Erase Me,' which earned support from BBC Radio 1 and major DJs. He has released on labels including Armada Music and has performed at Creamfields, SW4, and major UK venues. Known for his energetic DJ sets and hands-in-the-air moments, he represents a new generation of UK rave-inspired artists.",
    urls:['https://www.beatportal.com/articles/21326-introducing-ben-hemsley'] },

  { name:'Nostalgix', discogsId:7436686, realName:'Negar Hamidzadeh', country:'Canada',
    genres:['Bass House','House','G-House'],
    profile:"Nostalgix (real name: Negar Hamidzadeh) is a Persian-Canadian DJ and producer based in Los Angeles. She draws heavily from 90s hip-hop, pop culture, and her Iranian heritage to create a high-energy bass house sound. Forbes profiled her as a rising force in house music.\n\nShe is signed to Steve Aoki's Dim Mak Records and has released on Night Bass (AC Slater), Confession (Tchami), and Insomniac Records. Her tracks combine booming basslines with nostalgic samples and vocal hooks. She has performed at EDC Las Vegas, Beyond Wonderland, Hard Summer, and toured internationally. Known for her 90s 'it girl' aesthetic and infectious stage energy.",
    urls:['https://www.insomniac.com/music/artists/nostalgix/','https://www.forbes.com/sites/lisakocay/2020/09/18/nostalgix-house-music-producer/'] },

  { name:'Punctual', discogsId:5843528, realName:'Will Lansley & John Morgan', country:'UK',
    genres:['House','Dance','Pop'],
    profile:"Punctual is a British DJ and production duo from Newbury, Berkshire, consisting of Will Lansley and John Morgan. They met as teenagers and started DJing at Bristol University. Their debut single 'Eva' (2016) gained over 3 million Spotify streams and was supported by Zane Lowe and Pete Tong.\n\nSigned to Polydor in 2020, their breakout single 'I Don't Wanna Know' broke the UK Top 100 with over 50 million streams. They collaborated with Armin van Buuren on 'On & On' (2023). Their productions have accumulated over 1 billion combined streams.\n\nBeyond their own project, Will and John are prolific behind-the-scenes producers and co-writers for RAYE ('Black Mascara'), Ella Henderson & Switch Disco ('REACT' — BRIT-nominated Song of the Year 2024), Jason Derulo ('Acapulco'), Kylie Minogue, Clean Bandit, Joel Corry, Sub Focus, Rudimental, and many more. Festival appearances include Glastonbury, Creamfields, SW4, and Lovebox.",
    urls:['https://www.last.fm/music/Punctual/+wiki','https://www.monstercat.com/artist/punctual'] },

  { name:'Malugi', discogsId:8095344, realName:'', country:'Germany',
    genres:['Techno','House','Club'],
    profile:"Malugi is a Berlin-based DJ and producer known for high-energy club sets that blend techno, house, and trance influences. A resident of the Berlin underground scene, he has performed at Pukkelpop, featured on the Resident Advisor podcast series (RA.981), and plays regularly at key Berlin venues.\n\nHis productions channel euphoric, peak-time energy with a raw edge, and he has released on Bandcamp under his own imprint 'malugienergy.' His sound draws from classic rave culture, channeling both nostalgia and forward momentum.",
    urls:['https://ra.co/dj/malugi','https://malugienergy.bandcamp.com'] },

  { name:'Amber Broos', discogsId:13068861, realName:'Amber Broos', country:'Belgium',
    genres:['Techno','Peak Time Techno','Club'],
    profile:"Amber Broos is a rising Belgian DJ and producer born in 2002 in Leuven, Belgium. She grew up in a family of musicians and started DJing at age 13 after winning a competition. She is a key figure in Belgium's new generation of techno artists.\n\nHer style fuses techno, club, house, and Belgian retro influences. She hosts a monthly show on Tomorrowland's One World Radio and is a resident on Studio Brussel. At just 22, she became the youngest female DJ to perform on the Tomorrowland Mainstage — twice. She has also played Awakenings, Rock Werchter, Pukkelpop, Ushuaïa Ibiza, Untold Festival, and Drumsheds UK, and hosted her own stage at Tomorrowland.\n\nHer releases include 'Amok' (2023, Tomorrowland Music), 'The Pulse EP' (with The Subs), 'Scandalous' (with Portex), and 'Arpegia (Without You)' (with The Mackenzie, 2025) on Serious Beats Classics. Her tracks have been supported by Charlotte de Witte, Amelie Lens, Lilly Palmer, and Eli Brown.",
    urls:['https://www.awakenings.com/en/artists/amber-broos/285599','https://en.wikipedia.org/?curid=79233546'] },

  { name:'Antdot', discogsId:6205262, realName:'Bruno Gustavo', country:'Brazil',
    genres:['Afro House','Melodic House','Organic House'],
    profile:"Antdot (real name: Bruno Gustavo) is a Brazilian DJ and producer from Joinville, Santa Catarina. He has emerged as one of the most influential Brazilian artists in global electronic music, fusing organic grooves, Afro and Latin influences, and regional Brazilian sounds like samba and baião with contemporary melodic house.\n\nWith Maz, he became one of the first Brazilians to open Tomorrowland Belgium's MainStage. He was ranked Beatport's #2 best-selling Afro House DJ in 2023 and 2024. He co-founded Dawn Patrol Records with Maz, consistently among the Top 5 best-selling Afro House labels. His remix of 'Povoada' and 'Corpo e Canção' both reached #1 on Beatport's Afro House Chart. His remix of 'Your Love' was selected for the FIFA 26 Official Soundtrack and earned Gold certifications. He has accumulated over 271 million Spotify streams and in 2025 signed with WME.\n\nHe has performed at Hï Ibiza, Space Miami, Cercle, Rock in Rio, Kappa Futur Festival, and major Brazilian venues. Supported by Keinemusik, CamelPhat, Vintage Culture, and Black Coffee.",
    urls:['https://www.insomniac.com/music/artists/antdot/','https://www.extrema.be/en/bands/antdot'] },

  { name:'ELFIGO', discogsId:11699456, realName:'', country:'Belgium',
    genres:['Electronic','Dance'],
    profile:"ELFIGO is a 14-year-old Belgian DJ who made history as the youngest artist ever to perform at Tomorrowland Winter. His talent was discovered through Tomorrowland Academy, and he has quickly become a sensation in the youth DJ scene.\n\nAt Tomorrowland Winter 2026 in Alpe d'Huez, he delivered a high-energy set that went viral, earning coverage from EDM.com, We Rave You, Clash Magazine, and Imagine Magazine. His rise represents Tomorrowland's commitment to nurturing the next generation of electronic music talent through their Academy program. Described as a 'turntable technician,' he blends multiple genres with technical skill beyond his years.",
    urls:['https://www.tomorrowland.com/article/elfigo-at-tomorrowland-winter/'] },

  { name:'Vieze Asbak', discogsId:10984037, realName:'', country:'Netherlands',
    genres:['Hard Techno','Memetechno','Hardcore'],
    profile:"Vieze Asbak (Dutch for 'Dirty Ashtray') is a Dutch DJ and producer known as a leading figure in the 'memetechno' or 'memecore' movement. He started producing in 2021, creating tracks for friends that went viral on social media.\n\nHis sound blends powerful hard techno and hardcore beats with humor, absurd samples, viral internet sounds, and relentless kicks — sometimes called 'troll & bass.' With over 1.6 million monthly Spotify listeners, he has performed at major festivals including Tomorrowland, Sziget, and Lowlands. He collaborated with Dutch rapper Joost Klein on 'Friesenjung,' which became a gold-certified hit in Germany.\n\nHe co-founded the Pestcore Collective alongside Natte Visstick and Gladde Paling, hosting events like 'Pestival' that celebrate the genre's irreverent, playful spirit.",
    urls:['https://www.djguide.nl/djinfo.p?djid=10161'] },

  { name:'Bonzai All Stars', discogsId:2374599, realName:'Christian Pieters & Marnik Braeckevelt', country:'Belgium',
    genres:['Oldskool','Progressive House','Trance'],
    profile:"Bonzai All Stars is a legendary Belgian DJ duo consisting of Christian Pieters (aka Fly) and Marnik Braeckevelt. They are iconic figures in European electronic music, emerging from the legendary Bonzai Records/Lightning Records empire founded in 1992 by Pieters alongside Yves Deruyter and Franky Jones.\n\nAfter Lightning Records went bankrupt in 2003, Pieters and Braeckevelt co-founded Banshee Worx BVBA, which now operates the Bonzai Progressive banner overseeing 20-30 labels and distributing close to 100 worldwide. The Bonzai All Stars duo was formed to bring back the 'oldskool' 1990s sound, positioning themselves at the forefront of the retro rave revival.\n\nThey have performed at Tomorrowland (2011, 2012), Super Sonic Festival, Back To The 90s, and Cherry Moon Beach, and host the weekly radio show Bonzai Basik Beats.",
    urls:['https://partyflock.nl/artist/213','https://www.discogs.com/artist/512802'] },

  { name:'Sam Shure', discogsId:5456970, realName:'Samuel Schürmann', country:'Germany',
    genres:['Melodic House','Organic House','Afro House'],
    profile:"Sam Shure (real name: Samuel Schürmann) is an Egyptian-German DJ and producer based in Berlin. His father is Egyptian jazz musician Basem Darwisch, and his heritage deeply influences his music, which balances emotion, depth, and club energy with warm acoustic instrumentation.\n\nHis breakthrough on Stil Vor Talent with 'Kasra' and 'Nandoo' led to his debut album 'Laconia' (2019). He has released on Habitat Recordings (Mind Against), Cercle Records ('Your River' with Monolink, 2025), TAU, and Tomorrowland's CORE label. His music is supported by Dixon, Âme, Adriatique, Camelphat, Damian Lazarus, and Keinemusik.\n\nWith over 65 million streams, he has performed at Fabric London, Watergate, Sisyphos, Burning Man, WooMoon Ibiza & Tulum, ADE, and Epizode Festival.",
    urls:['https://www.beatport.com/artist/sam-shure/556647'] },

  { name:'Thakzin', discogsId:12199720, realName:'Thabang Mathebula', country:'South Africa',
    genres:['Afro House','Afro Tech','3-Step','Deep House'],
    profile:"Thakzin (real name: Thabang Mathebula) is a South African DJ and producer from Ivory Park, Johannesburg. Born in 1993 into a deeply musical family, he was introduced to piano by his father and shaped by kwaito, jazz, and South African house pioneers like Black Coffee and Culoe De Song.\n\nHe is widely credited as the pioneer of '3-Step,' a sub-genre fusing Afro-house, deep house, gqom, and amapiano, defined by removing one kick from the traditional 4/4 pattern. His breakthrough track 'The Magnificent Dance' (2022) became the defining 3-Step anthem, earning co-signs from Kaytranada, Louie Vega, and Black Coffee.\n\nHe was selected as a Spotify RADAR Artist for Southern Africa (2025). His debut album 'God\\'s Window Pt. 1' (18 tracks) was released in September 2025. He has collaborated with Shimza, THEMBA, Sun-EL Musician, and Moonchild Sanelly. His sound is deeply influenced by the Sangoma (traditional healer) rituals of his community, viewing music as a healing, spiritual vessel.",
    urls:['https://ra.co/dj/thakzin','https://mixmag.net/feature/the-mix-076-thakzin'] },

  { name:'AWEN', discogsId:387362, realName:'', country:'France',
    genres:['Afro House','Melodic House','Vocal House'],
    profile:"AWEN is a French vocalist, songwriter, and DJ specializing in Afro house and melodic house. She performs a distinctive hybrid set combining live vocals with DJing. Her name means 'muse' or 'inspiration' in Welsh.\n\nShe has collaborated with major Afro house producers and performed at venues including Tomorrowland Winter and international Afro house events. Her voice and presence have made her a sought-after vocalist in the global Afro house scene, represented by Metropole Agency.",
    urls:['https://metropole.agency/awen'] },

  { name:'Franky Kloeck', discogsId:54312, realName:'Franky Kloeck', country:'Belgium',
    genres:['Techno','Progressive Trance','Jumpstyle'],
    profile:"Franky Kloeck is a Belgian techno legend and one of the pioneers of the Belgian club scene, active since 1992. He became a resident DJ at the legendary Cherry Moon club for 4 years and played at iconic afterclub Carat (1994-1996) and Bel-Air. After Cherry Moon, he held residencies at Extreme, BBC, Globe, Illusion, Zillion, and Fuse.\n\nHe was part of Cherry Moon Trax, responsible for massive releases on Bonzai Records including 'Let There Be House,' 'In My House,' and the landmark track 'The House Of House,' which pioneered a harder-edged progressive and trance sound. He has performed at Tomorrowland and toured internationally across Europe. His sets are known as tight, dark, and intense — pure, no-nonsense techno.",
    urls:['https://partyflock.nl/artist/548/biography','https://musicbrainz.org/artist/7b24294e-43ea-4ee5-8252-62b023c7fdce'] },

  { name:'Blondex', discogsId:13487503, realName:'', country:'Belgium',
    genres:['Techno','Hard Techno'],
    profile:"Blondex is a Belgian DJ and producer making waves in the techno scene. He has performed at Tomorrowland, Awakenings, and international venues including in China (Shenzhen). Booked by Orbit Booking agency, he represents the new wave of Belgian techno talent with a hard-hitting, high-energy sound.",
    urls:['https://ra.co/dj/blondex','https://www.orbit-booking.com/?site=artist/blondex.html'] },

  { name:"Malaa's  Alter Ego", discogsId:15599355, realName:'Sébastien Bouaziz (Malaa)', country:'France',
    genres:['Drum & Bass','Hard Techno','Electro'],
    profile:"Malaa's Alter Ego is a separate project/persona by French producer Malaa (Sébastien Bouaziz), launched in September 2024 as a deliberate departure from Malaa's signature dark bass/G-house sound. While Malaa is known for the black balaclava and criminal-themed G-house on Tchami's Confession label, the Alter Ego explores drum & bass, hard techno, glitchy electro, and UK garage influences.\n\nThe debut Alter Ego album 'Blackout' dropped in January 2025. Other Alter Ego tracks include 'Make It Work,' 'Mango Disco' (with Odymel), 'Psycho,' and 'Murderer.' The two personas are pitted against each other in a 'Malaa vs Alter Ego' 360° Tour, where fans choose a side in a playful head-to-head live format.",
    urls:['https://www.discogs.com/artist/4581113-Malaa','https://mixmag.asia/read/malaas-alter-ego-drops-high-octane-track-make-it-work'] },

  { name:'Sleazy Stereo', discogsId:4065455, realName:'', country:'Belgium',
    genres:['Electronic','House','Club'],
    profile:"Sleazy Stereo is a Belgian DJ and producer duo known for their energetic club sets. They have performed at Tomorrowland and international venues including Zouk Singapore, and are regulars in the Belgian and Dutch club circuit.",
    urls:['https://www.bandsintown.com/a/2613435-sleazy-stereo'] },
];

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const djsColl = db.collection('djs');
  console.log('✅ 连接 MongoDB\n');

  let created=0, updated=0, skipped=0;
  for (const a of BIOS) {
    const existing = await djsColl.findOne({ discogsId: a.discogsId });
    if (existing && existing.profile && existing.profile.length > 50) {
      skipped++;
      continue;
    }
    if (existing) {
      await djsColl.updateOne({ discogsId: a.discogsId }, { $set: {
        name: a.name, realName: a.realName, profile: a.profile,
        country: a.country, genres: a.genres, styles: a.genres,
        urls: a.urls, crawledAt: new Date(), source: 'web-research'
      }});
      updated++;
      console.log(`  📝 ${a.name} (discogs:${a.discogsId})`);
    } else {
      await djsColl.insertOne({
        discogsId: a.discogsId, name: a.name, realName: a.realName,
        profile: a.profile, country: a.country,
        genres: a.genres, styles: a.genres, urls: a.urls,
        crawledAt: new Date(), source: 'web-research'
      });
      created++;
      console.log(`  ✅ ${a.name} (discogs:${a.discogsId})`);
    }
  }

  // 统计
  const perfs = await db.collection('artist_performances').find({activityLegacyId:7}).toArray();
  const am=new Map(); for(const p of perfs){const k=p.artistName.toLowerCase().replace(/[^a-z0-9]/g,'');if(!am.has(k))am.set(k,p);}
  const allMaps=await db.collection('dj_discogs_map').find({}).toArray();
  const mbk=new Map(allMaps.map(d=>[d.lineupNameKey,d]));
  const allDjs=await db.collection('djs').find({}).toArray();
  const djById=new Map(allDjs.map(d=>[d.discogsId,d]));

  let mapped=0,noBio=0,weakG=0,noDiscogs=0,pending=0,unmapped=0;
  const WEAK=new Set(['electronic','dance','edm','pop','unknown']);
  for(const [key,a] of am){
    const map=mbk.get(key);
    if(!map){unmapped++;continue;}
    if(map.status==='pending_review'){pending++;continue;}
    if(!map.discogsId){noDiscogs++;continue;}
    const dj=djById.get(map.discogsId);
    const hasBio=dj?.profile&&dj.profile.length>10;
    const genres=[...(map.displayGenres||[]),...(map.displayStyles||[]),a.genre,a.genreLabel].filter(g=>g&&g!=='Unknown'&&g!=='风格待补充');
    const gOk=genres.length>0&&!genres.every(g=>WEAK.has(g.toLowerCase()));
    if(!hasBio)noBio++;
    else if(!gOk)weakG++;
    else mapped++;
  }

  console.log(`\n📊 本次: ✅新建${created} 📝更新${updated} ⏭️跳过${skipped}`);
  console.log(`\n📈 TML Belgium:`);
  console.log(`   ✅ Mapped: ${mapped}/${am.size} (${(mapped/am.size*100).toFixed(1)}%)`);
  console.log(`   📝 有 Discogs 缺 Bio: ${noBio}`);
  console.log(`   ⚠️  有 Bio 流派弱: ${weakG}`);
  console.log(`   ❌ 无 Discogs: ${noDiscogs}`);
  console.log(`   ⏳ 待审核: ${pending}`);
  console.log(`   🚫 无映射: ${unmapped}`);

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}
main().catch(e=>{console.error(e);process.exit(1);});
