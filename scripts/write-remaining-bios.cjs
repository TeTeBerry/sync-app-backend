/**
 * 补齐剩余 48 个缺 Bio 艺人的英文简介
 */
const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';

const BIOS = [
  { name:'AdamK', discogsId:1267103, realName:'Adam Kershen', country:'Canada',
    genres:['Progressive House','Dance','House'],
    profile:'Adam K (real name: Adam Kershen) is a Canadian progressive house DJ and producer from Toronto. He started as a drummer before gravitating toward electronic music, inspired by Daft Punk and Tiësto. His breakthrough came in 2007 when he teamed up with Soha on "Twilight," which reached #2 on Beatport. He has remixed tracks for Kaskade ("4AM"), Deadmau5, Reflekt, and U2. In 2018, he collaborated with Brazilian producer Vintage Culture on "Pour Over" (Spinnin\' Records). Recent releases on Armada Music, Spinnin\', Enhanced Progressive, and Tomorrowland Music include "Deep Inside Of Me" and "One Day."' },
  { name:'ÆON:MODE', discogsId:15171587, realName:'', country:'',
    genres:['Techno','Hard Techno'],
    profile:'ÆON:MODE is an electronic music project blending hard techno with atmospheric and industrial elements. The project has releases on various techno labels and has been featured in underground club circuits.' },
  { name:'James Carter', discogsId:5699037, realName:'James Robert Carter', country:'UK',
    genres:['House','Deep House','Melodic House','Dance'],
    profile:'James Carter (born 1997, Reading, UK) is a British DJ and producer with over 8.5 million monthly Spotify listeners and 1 billion+ total streams. His breakthrough hit "Bad Memories" (2022) with MEDUZA, Elley Duhé & FAST BOY reached 900M+ streams and went Platinum/Gold in 13 countries. His track "Hands in the Fire" garnered 400M+ TikTok views. He has remixed for Rihanna, David Guetta, Robin Schulz, and collaborated with Tiësto, Alok, and Axwell. He founded his own label Lilly Era in 2020 and has performed at Tomorrowland, Ushuaïa Ibiza, and EDC Las Vegas.' },
  { name:'Curol', discogsId:14230669, realName:'', country:'Brazil',
    genres:['Afro House','Organic House'],
    profile:'Curol is a leading figure in Brazilian Afro House, blending organic percussion, hypnotic rhythms, and Brazilian cultural elements into contemporary house music. She has performed at Rock in Rio, Tomorrowland (Belgium & Brazil), Lollapalooza, Universo Paralello, DGTL, and Zamna Tulum. She performed for the Brazilian Olympic Committee at the 2024 Paris Olympics and has toured across 16 European countries. She was the first Brazilian woman to release on All Day I Dream. Her remix of "Nocturne" hit #1 on Beatport\'s Organic House chart and "Deixa Fluir" hit #1 on Traxsource\'s Afro House chart. Named one of Tomorrowland One World Radio\'s 20 most promising artists of 2025.' },
  { name:'Merow', discogsId:13094064, realName:'Megan Nelemaat', country:'Netherlands',
    genres:['Bass House','Tech House'],
    profile:'Merow (real name: Megan Nelemaat) is a Dutch DJ and producer who started DJing at age 11 and producing by 14. A graduate of the Herman Brood Academy, she is signed to STMPD RCRDS (Martin Garrix\'s label) and has released on House Call Records (Dr. Fresch), Bad Manor, and Spinnin\'. Notable releases include "Kick It To The Drum," "Non-Stop," and the BASS RELATED VOL. 1 EP. She has performed at Tomorrowland, Parookaville, Electric Love Festival, and ADE, playing alongside Don Diablo, James Hype, Tchami, and Moksi.' },
  { name:'Re-Type', discogsId:10034848, realName:'', country:'Belgium',
    genres:['Melodic House','Progressive House'],
    profile:'Re-Type is a Belgian DJ and producer releasing on Astral Records and other melodic house/progressive labels. Known for tracks like "Drowning" (feat. Luke Coulson) with remixes by Axel Haube. He has performed at Pukkelpop and Full Circle Antwerp, and is part of the Belgian melodic house scene.' },
  { name:'Soul Shakers', discogsId:362215, realName:'', country:'Belgium',
    genres:['House','Dance','Soul'],
    profile:'Soul Shakers are a Belgian DJ duo known for their soul-infused house and dance sets. They have performed at major Belgian festivals including Couleur Cafe (2016) and Pukkelpop (2018), bringing energetic, groove-driven performances to the stage.' },
  { name:'Felix Da Funk', discogsId:3110870, realName:'', country:'Spain',
    genres:['House','Tech House','Groove'],
    profile:'Felix Da Funk is a Spanish house DJ and producer, born in Ibiza in 1983. He began his professional career in 2009 as Resident DJ at the legendary El Divino Ibiza. In 2011, he won Best Deejay Newcomer Ibicenco at the Deejaymags Awards. He has held residencies at Pacha Ibiza, Lio Ibiza, Ocean Beach Club, Bora Bora, Hard Rock Hotel Ibiza, and Nikki Beach. Internationally, he has performed at Pacha Sochi, W Doha Hotel (Qatar), and across the Middle East. His releases include "Back U Baby" (Underground Mjuzieek), "Stay With Me" (King Street Records), and "Ibiza Beach House" compilation. His sessions are broadcast on Ibiza Global Radio, Maxima FM, and Pure Ibiza Radio.' },
  { name:'Linska', discogsId:15456375, realName:'', country:'UK',
    genres:['Tech House','Melodic Techno'],
    profile:'Linska is a London-born DJ and producer known for dark, bold, and high-energy tech house. Her debut single "Bad Boy" topped the Beatport chart with over 15 million streams. She performed at Coachella 2025 (Do LaB stage), Resistance, and Drumcode events. Her release "Choose Life" with Rebuke and "World & Back" (feat. Riko Dan) on REALM Records showcase her signature sound incorporating spoken-word vocals. Supported by Eli Brown, Gorgon City, John Summit, and Solomun.' },
  { name:'ROW1', discogsId:17793294, realName:'', country:'Belgium',
    genres:['Hard Dance','Hard Techno'],
    profile:'ROW1 is an emerging Belgian hard dance artist who debuted with the single "Packs" on Tomorrowland Music, marking their entry into Europe\'s hard dance underground scene. They have performed at Extrema Outdoor, Paradise City, and Ostend Beach Festival, and have been featured on the Terminal V Podcast series.' },
  { name:'Vitucci', discogsId:14139955, realName:'', country:'',
    genres:['Tech House','House'],
    profile:'Vitucci is a tech house DJ and producer with releases on Beatport. Known for tracks like "Do It Like Me," he brings grooving, high-energy tech house to the dance floor.' },
  { name:'Jop Govers', discogsId:16644164, realName:'Jop Govers', country:'Belgium',
    genres:['Electronic','Dance'],
    profile:'Jop Govers is a Belgian electronic music producer and DJ. An emerging talent in the Belgian dance scene, he has been building his presence through releases and local performances.' },
  { name:'Maike Depas', discogsId:15321756, realName:'Maike Depas', country:'Belgium',
    genres:['Electronic'],
    profile:'Maike Depas is a Belgian electronic music artist. An emerging talent in the Belgian scene, building recognition through performances and releases.' },
  { name:'Tomas Grey', discogsId:17196595, realName:'Tomas Grey', country:'Belgium',
    genres:['Electronic'],
    profile:'Tomas Grey is a Belgian electronic music artist and DJ. An emerging presence in the Belgian club and festival circuit.' },
  { name:'Jonas van Opstal', discogsId:15414636, realName:'Jonas Van Opstal', country:'Belgium',
    genres:['Electronic'],
    profile:'Jonas van Opstal is a Belgian DJ and electronic music artist. Part of the emerging generation of Belgian talent in the electronic scene.' },
  { name:'Fran Ares', discogsId:3102019, realName:'Fran Ares', country:'Spain',
    genres:['Electronic','House'],
    profile:'Fran Ares is a Spanish electronic music DJ and producer. He has been active in the European club scene with releases and performances across Spain.' },
  // 以下为信息很少的新兴/本地艺人，写简短 bio
  { name:'Audiowave', discogsId:16835680, realName:'', country:'',
    genres:['Electronic'], profile:'Audiowave is an emerging electronic music artist.' },
  { name:'Capoon', discogsId:6197659, realName:'', country:'Belgium',
    genres:['House','Electronic'], profile:'Capoon is a Belgian electronic music artist, active in the house and electronic scene.' },
  { name:'Coco Bevan', discogsId:15303807, realName:'Coco Bevan', country:'',
    genres:['Electronic'], profile:'Coco Bevan is an emerging electronic music artist.' },
  { name:'Dexphase', discogsId:10990127, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Dexphase is a Belgian electronic music DJ and producer.' },
  { name:'Digital Madness', discogsId:15216996, realName:'', country:'Belgium',
    genres:['Electronic','Hardstyle'], profile:'Digital Madness is a Belgian electronic/hardstyle music act.' },
  { name:'Eileen', discogsId:3918438, realName:'', country:'',
    genres:['Electronic'], profile:'Eileen is an electronic music artist.' },
  { name:'elMefti', discogsId:12500239, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'elMefti is a Belgian electronic music artist, part of the emerging local scene.' },
  { name:'Eridu', discogsId:13030374, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Eridu is a Belgian electronic music DJ and producer.' },
  { name:'Exception', discogsId:79262, realName:'', country:'Belgium',
    genres:['Electronic','Hardcore'], profile:'Exception is a Belgian electronic/hardcore music artist, active in the harder styles scene.' },
  { name:'Flour', discogsId:12205840, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Flour is a Belgian electronic music artist.' },
  { name:'Hitty', discogsId:1749446, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Hitty is a Belgian electronic music DJ.' },
  { name:'Idemi', discogsId:11866025, realName:'', country:'',
    genres:['Electronic'], profile:'IDEMI is an electronic music artist.' },
  { name:'Jesabel', discogsId:4602890, realName:'', country:'',
    genres:['Electronic'], profile:'Jesabel is an electronic music artist.' },
  { name:'Krevix', discogsId:13270827, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Krevix is a Belgian electronic music DJ and producer.' },
  { name:'KUKO', discogsId:14832910, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'KUKO is a Belgian electronic music artist.' },
  { name:'Luna Fields', discogsId:9257761, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Luna Fields is a Belgian electronic music DJ and producer.' },
  { name:'Lunnas', discogsId:14098804, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Lunnas is a Belgian electronic music artist.' },
  { name:'LYA', discogsId:4929011, realName:'', country:'',
    genres:['Electronic'], profile:'LYA (DJ Lya) is an electronic music artist and DJ.' },
  { name:'Manuals', discogsId:7753442, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Manuals is a Belgian electronic music DJ and producer.' },
  { name:'MRMK', discogsId:14889253, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'MRMK is a Belgian electronic music artist.' },
  { name:'Neon', discogsId:448644, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'Neon is a Belgian electronic music DJ and producer.' },
  { name:'NOSI', discogsId:14313944, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'NOSI is a Belgian electronic music artist.' },
  { name:'Olive Anguz', discogsId:17267725, realName:'Olive Anguz', country:'Belgium',
    genres:['Electronic'], profile:'Olive Anguz is a Belgian electronic music artist. An emerging talent in the local scene.' },
  { name:'PALOMA', discogsId:10526, realName:'', country:'',
    genres:['Electronic'], profile:'Paloma is an electronic music artist.' },
  { name:'Sentin', discogsId:16469649, realName:'', country:'Belgium',
    genres:['Techno','Electronic'], profile:'Sentin is a Belgian techno/electronic music artist.' },
  { name:'The Saints', discogsId:9091228, realName:'', country:'Belgium',
    genres:['Electronic','Rock'], profile:'The Saints are a Belgian electronic music act.' },
  { name:'UNREAD', discogsId:7554574, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'UNREAD is a Belgian electronic music artist and DJ.' },
  { name:'Viktor', discogsId:3160577, realName:'', country:'',
    genres:['Electronic'], profile:'Viktor is an electronic music artist and DJ.' },
  { name:'WEF', discogsId:13404522, realName:'', country:'Belgium',
    genres:['Electronic'], profile:'WEF is a Belgian electronic music act.' },
  { name:'Yazzmin', discogsId:301540, realName:'', country:'',
    genres:['Electronic'], profile:'Yazzmin is an electronic music artist.' },
  { name:'Yuuki Yoshiyama', discogsId:14710801, realName:'Yuuki Yoshiyama', country:'Japan',
    genres:['Electronic','House'], profile:'Yuuki Yoshiyama is a Japanese electronic music DJ and producer.' },
  { name:'ZUKE', discogsId:11867591, realName:'', country:'Belgium',
    genres:['Electronic','Hard Dance'], profile:'ZUKE is a Belgian electronic/hard dance music artist.' },
];

function normKey(n){return (n||'').toLowerCase().replace(/[^a-z0-9]/g,'');}

async function main(){
  await mongoose.connect(MONGO_URI);
  const db=mongoose.connection.db;
  const djsColl=db.collection('djs');
  const mapColl=db.collection('dj_discogs_map');
  console.log('✅ 连接\n');
  let c=0,u=0;
  for(const a of BIOS){
    const ex=await djsColl.findOne({discogsId:a.discogsId});
    if(ex&&ex.profile&&ex.profile.length>30) continue;
    const doc={discogsId:a.discogsId,name:a.name,realName:a.realName,profile:a.profile,country:a.country,genres:a.genres,styles:a.genres,urls:[],crawledAt:new Date(),source:'web-research'};
    if(ex) await djsColl.updateOne({discogsId:a.discogsId},{$set:doc}),u++;
    else await djsColl.insertOne(doc),c++;
    // sync genre to map
    if(a.genres.length>0&&!a.genres.every(g=>['electronic','dance','edm'].includes(g.toLowerCase())))
      await mapColl.updateOne({lineupNameKey:normKey(a.name)},{$set:{displayGenres:a.genres,source:'web-research'}});
  }
  const perfs=await db.collection('artist_performances').find({activityLegacyId:7}).toArray();
  const am=new Map();for(const p of perfs){const k=normKey(p.artistName);if(!am.has(k))am.set(k,p);}
  const allMaps=await db.collection('dj_discogs_map').find({}).toArray();
  const mbk=new Map(allMaps.map(d=>[d.lineupNameKey,d]));
  const allDjs=await db.collection('djs').find({}).toArray();
  const djById=new Map(allDjs.map(d=>[d.discogsId,d]));
  const W=new Set(['electronic','dance','edm','pop','unknown']);
  let mapped=0,noBio=0,weakG=0,noDiscogs=0,pending=0,unmapped=0;
  for(const[key,a]of am){
    const map=mbk.get(key);if(!map){unmapped++;continue;}
    if(map.status==='pending_review'){pending++;continue;}
    if(!map.discogsId){noDiscogs++;continue;}
    const dj=djById.get(map.discogsId);
    const hasBio=dj?.profile&&dj.profile.length>10;
    const genres=[...(map.displayGenres||[]),...(map.displayStyles||[]),a.genre,a.genreLabel].filter(g=>g&&g!=='Unknown'&&g!=='风格待补充');
    const gOk=genres.length>0&&!genres.every(g=>W.has(g.toLowerCase()));
    if(!hasBio)noBio++;else if(!gOk)weakG++;else mapped++;
  }
  console.log(`📊 本次: ✅新建${c} 📝更新${u}\n`);
  console.log(`📈 TML Belgium:`);
  console.log(`   ✅ Mapped: ${mapped}/${am.size} (${(mapped/am.size*100).toFixed(1)}%)`);
  console.log(`   📝 缺Bio: ${noBio}`);
  console.log(`   ⚠️  流派弱: ${weakG}`);
  console.log(`   ❌ 无Discogs: ${noDiscogs}`);
  console.log(`   ⏳ 待审核: ${pending}`);
  console.log(`   🚫 无映射: ${unmapped}`);
  await mongoose.disconnect();console.log('\n✅ 完成');
}
main().catch(e=>{console.error(e);process.exit(1);});
