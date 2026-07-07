/**
 * 将联网搜索到的艺人 Bio 写入 djs 表 + 关联 dj_discogs_map
 * 用法: cd sync-app-backend && node scripts/write-artist-bios.cjs
 */

const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/sync-ai';

// Synthetic Discogs ID 起点 (与现有 990000000+ 体系对齐)
let nextSyntheticId = 999991000;

function normKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ===== 艺人 Bio 数据 (来自联网搜索) =====
// discogsId: 正数 = 真实 Discogs ID, 0 = 自动分配 synthetic ID

const ARTIST_BIOS = [
  // ─── 有真实 Discogs ID 但 djs 表中缺记录 ───
  {
    name: 'John 00 Fleming',
    discogsId: 11706,
    realName: 'John Andrew Fleming',
    country: 'UK',
    genres: ['Trance', 'Psychedelic Trance', 'Progressive Trance'],
    profile: 'John "00" Fleming is a British trance and psy-trance DJ, producer, and remixer with a career spanning over 35 years. Born in 1969 in Sunderland, UK, he began DJing at the age of 15 and held a residency at the legendary Sterns nightclub. He survived lung cancer in his early 20s before embarking on a prolific career.\n\nFleming founded JOOF Recordings in 1998 and has released over 40 albums and mix compilations, with over 10 million sales worldwide. He has performed at major clubs including Cream, Gatecrasher, Ministry of Sound, and Godskitchen, and at festivals such as Boom, Ozora, Tomorrowland, EDC, and Creamfields.\n\nHe has also scored music for film and television, working with the Royal Philharmonic Orchestra at Abbey Road Studios. BBC Radio 1 described him as "a national treasure of trance music." Notable albums include "Nine Lives," "One.Hundred.Ten W.K.O," "Alter Ego," and the "JOOF Editions" mix series.',
    urls: ['https://www.discogs.com/artist/11706', 'https://www.john00fleming.com'],
  },
  {
    name: 'Sofia Cristo Garcia',
    discogsId: 1769971,
    realName: 'Sofia Cristo Garcia',
    country: 'Spain',
    genres: ['Techno', 'House', 'Electronic'],
    profile: 'Sofía Cristo is a Spanish DJ and producer, born in 1983. She is the daughter of well-known Spanish public figures Bárbara Rey and Ángel Cristo. Performing under the alias Sofia DJ, she produces and performs electronic music spanning techno, house, and electronic genres.\n\nHer releases include "Ritmo de la Noche" (2025) and "The Power of Love" (2025) on Kitsune Records, as well as "Marionetas de Cartón" (2023), "We Fight" (2022), and "Tres Cosas (Salud, Dinero y Amor)" (2022). She has also produced remixes for various Spanish artists including "El Paraíso (Remix)" and "Amor de Verano (Remix)."',
    urls: ['https://www.discogs.com/artist/1769971'],
  },

  // ─── 已确认 Discogs 但需确认 artist ID ───
  {
    name: 'Öona Dahl',
    discogsId: 0,
    realName: 'Öona Dahl',
    country: 'USA',
    genres: ['Deep House', 'Melodic House & Techno', 'Progressive House', 'Ambient'],
    profile: 'Öona Dahl is an American DJ and producer from Upstate New York, currently based in Berlin, Germany. She began making music in Acid Pro and Fruity Loops as a teenager, inspired by the Toronto rave scene. After studying sound design in Florida, she connected with DJ Three (Hallucination Recordings), which led to her debut album deal.\n\nHer debut EP "Let The Light In" was released in 2016 on Lee Burridge\'s All Day I Dream label. Her debut album "Holograma" followed in 2017 on Hallucienda. Subsequent releases include "Baba" (2018) and "Astral Realm" (2019) on Anjunadeep, "Godtripper EP" (2020) on Watergate Records, and "High Priestesses EP" (2025) on Watergate Records. Her second album "Morph" was released in 2021 on Hallucienda.\n\nÖona has performed at major festivals including Tomorrowland, EDC, Ultra Music Festival, and Boom Festival, and at renowned Berlin clubs Watergate and Katerblau. Her name derives from her spirit guide, and she is known for blending club-oriented deep/melodic house with experimental, vocal-driven electronica.',
    urls: ['https://www.discogs.com/release/5957046', 'https://www.insomniac.com/music/artists/oona-dahl/'],
  },
  {
    name: 'Von Bikräv',
    discogsId: 0,
    realName: '',
    country: 'France',
    genres: ['Gabber', 'Hardcore', 'Frapcore'],
    profile: 'Von Bikräv is a French DJ and electronic producer, known for being a member of the Casual Gabberz collective. He is credited as a pioneer of "frapcore" — a genre blending gangsta rap with gabber techno influences. He produces, mixes, and remixes his own work.\n\nHis notable releases include the 2-CD album "100% Bibi" (2019, Casual Gabberz Records) featuring 23 tracks plus a DJ mix, the single "XTSPD," and collaborative projects including "Evil Bikräv" (2017, with Evil Grimace). He has also released remixes for French rapper Jul ("Beuh Magique") and Contrefaçon ("Fugue 451").\n\nIn 2023, he founded his own label 20CONTRE1. He hosts mixes for the NADCAST podcast series and is associated with the broader French underground electronic scene alongside acts like ascendant vierge, Voiron, Krampf, and Maud Geffray.',
    urls: ['https://www.discogs.com/release/14108353', 'https://www.discogs.com/release/13017362'],
  },
  {
    name: 'David Löhlein',
    discogsId: 0,
    realName: 'David Löhlein',
    country: 'Germany',
    genres: ['Techno', 'Hard Techno', 'Industrial Techno'],
    profile: 'David Löhlein is a German techno producer known for his hard-hitting, industrial-influenced sound. His most notable release is the "Seyla EP" on SK_Eleven (2020, repressed 2023), which has become a sought-after vinyl release. He also released "VISION I - Nysa EP" on his VISION label, and has collaborated with Rove Ranger on the "Vision Ekstase" series.\n\nHis music is distributed through Triple Vision and Word and Sound, and his tracks appear on labels including KEY Vinyl and SK_Eleven. His sound sits at the intersection of hard techno, industrial, and raw club music.',
    urls: ['https://www.discogs.com/master/1685499', 'https://www.discogs.com/release/14804509'],
  },

  // ─── 确认真实艺人但无 Discogs (synthetic ID) ───
  {
    name: 'Delafino',
    discogsId: 0,
    realName: 'Philip Delafino',
    country: 'Belgium',
    genres: ['House', 'Soulful House', 'Funky House', 'Vocal House'],
    profile: 'Delafino (real name: Philip Delafino) is a veteran Belgian house DJ from Antwerp, active since the early 1990s. He began DJing at age 17, recording radio mixes and making bedroom mixtapes. His passion was sparked in the 1980s by soul and disco icons like Barry White and Donna Summer.\n\nHis musical style is characterized as funky, soulful, vocal, and happy house music. He has held residencies at Versuz Club and Shomi, as well as at Belgian editions of Defected in the House and Hed Kandi nights. He is a resident on FG Radio and has provided guest mixes for Ibiza Global Radio and Studio Ibiza.\n\nDelafino curates his own stage concept at Tomorrowland and has performed at major Belgian festivals including Extrema Outdoor, Laundry Day, Summer Festival, Solar Weekend, and Genk On Stage, plus clubs such as La Rocca, Carré, and Club Industria.',
    urls: ['https://www.extrema.be/en/bands/delafino', 'https://partyflock.nl/artist/45998'],
  },
  {
    name: 'Christian82',
    discogsId: 0,
    realName: '',
    country: 'Belgium',
    genres: ['Deep House', 'Afro-House', 'Tech-House', 'Classic House'],
    profile: 'Christian82 is a Belgian house and electronic music DJ/producer from Antwerp with over 10 years of experience in the Belgian electronic music scene. His sound spans deep house, Afro-house, tech-house, and classic house.\n\nHis signature style is described as "sweet, mellow music" — warm grooves, happy vocals, and an uplifting, soulful edge. His personal motto is: "love the music, sweet mellow music… It keeps me alive."\n\nChristian82 has performed at Belgium\'s most notable electronic music events including Tomorrowland, Extrema Outdoor, WECANDANCE, Ostend Beach Festival, MIRA Festival, and Mirador (Antwerp) alongside Joris Voorn.',
    urls: ['https://www.extrema.be/en/bands/christian82', 'https://partyflock.nl/artist/91053'],
  },
  {
    name: 'Milinguap',
    discogsId: 0,
    realName: '',
    country: 'Belgium',
    genres: ['Afrobeats', 'Afrohouse', 'Dancehall'],
    profile: 'Milinguap is a Belgium-based DJ known for her infectious love for Afro-Caribbean music. Her sound spans Afrobeats, Afrohouse, and Dancehall, with performances described as "a kaleidoscope of rhythmic beats and sensual vibes" that transport audiences to tropical settings.\n\nShe has performed at some of Belgium\'s most prestigious stages including Tomorrowland, Reggae Geel, Couleur Cafe, Bomboclat Festival, and Ostend Beach Festival. She is represented by the Kurious booking agency. Her artist bio emphasizes "authenticity & connection" at the heart of her artistry, aiming to create an atmosphere where everyone feels "liberated and united through the universal language of music."',
    urls: ['https://kurious.be/artist/milinguap/', 'https://full-circle.be/ghent/artist/milinguap/'],
  },
  {
    name: 'Karakals',
    discogsId: 0,
    realName: '',
    country: 'Belgium',
    genres: ['Electronic', 'Drum & Bass', 'Dance', 'Trance'],
    profile: 'Karakals is an emerging Belgian electronic music artist from Antwerp, booked exclusively through Platform Agency. His sets feature commercial hits, high-energy edits, and custom bootlegs, known for technical precision and infectious energy behind the decks.\n\nHe has performed at major festivals including Tomorrowland (Library Stage, 2025), Tomorrowland Winter (2026, Alpe d\'Huez), Rock Werchter (The Towers stage, 2025), Ostend Beach Festival (mainstage), Sunrise Festival, and Maanrock (Mechelen). Internationally, he has played at Balaton Sound (Hungary) and Tropics (Spain). His track "My Heart" (Trance) was released in February 2026.',
    urls: ['https://www.platformagency.be/en/karakals', 'https://www.viberate.com/artist/karakals/'],
  },
  {
    name: 'BYØRN',
    discogsId: 0,
    realName: 'Bjorn Verbeeck',
    country: 'Belgium',
    genres: ['Hard Techno', 'Hard Dance', 'Hardcore', 'Neo Rave'],
    profile: 'BYØRN (real name: Bjorn Verbeeck) is a Belgian hard techno DJ and producer from Antwerp. Known for high-energy performances and a boundary-pushing fusion of hard techno, psy, and cinematic elements, he was named Beatport\'s best-selling hard techno artist in 2024 and has accumulated over 20 million streams worldwide.\n\nHis notable releases include the "Ragnarok" EP (2024) on Amelie Lens\' Exhale label, "Ekstasis" EP (2023) on No Mercy, "Asgard" (2023) on Deestricted, and tracks on Etruria Beat (Luca Agnelli), Taapion (Shlømo), and Revised Records. His track "Bass Fusion" reached #1 on Beatport Hard Techno Top 100.\n\nHe has received support from Amelie Lens, Alignment, Farrago, Nico Moreno, and SHLØMO.',
    urls: ['https://ra.co/dj/byorn', 'https://www.beatport.com/artist/byrn/1106234'],
  },
  {
    name: 'Nastya Dikikh',
    discogsId: 0,
    realName: 'Nastya Dikikh',
    country: 'Belgium',
    genres: ['Techno', 'Hard Techno'],
    profile: 'Nastya Dikikh is a Belgian techno DJ and emerging producer known for high-energy sets with a fast-paced, powerful sound. She began her DJ journey behind the decks in Sydney, Australia, and now brings her mix of powerful kicks and euphoric/dark techno to European dance floors.\n\nShe has supported heavyweight acts including 999999999, Charlie Sparks, Rebekah, Øtta, and BYØRN, marking her as a rising name in the new wave of techno. She has performed at notable venues including C12 (Brussels), BASIS (Netherlands), Ampere (Antwerp), and has been part of UMI events.',
    urls: ['https://ra.co/dj/nastyadikikh'],
  },
  {
    name: 'Cici Daze',
    discogsId: 0,
    realName: '',
    country: 'Netherlands',
    genres: ['Deep Tech', 'Minimal House', 'Tech House'],
    profile: 'Cici Daze is a rising house DJ from Eindhoven, Netherlands, specializing in groovy deep-tech, minimal house, and tech-house music. Her sound is characterized by driving basslines blended with organic percussion, with a reputation for contagious energy and engaging stage presence.\n\nShe has already performed at major events and festivals including Tomorrowland, Thuishaven, Solar, Loveland, Complex Festival, Joy X Flow, Emporium, Op Dreef Festival, and Zomaarpop Festival.',
    urls: ['https://www.viberate.com/artist/cici-daze/', 'https://complexfestival.com/artists/cici-daze'],
  },
  {
    name: 'MELV!EE',
    discogsId: 0,
    realName: '',
    country: 'Netherlands',
    genres: ['Eclectic', 'House'],
    profile: 'MELV!EE is a DJ born and raised in Amsterdam North, Netherlands. He is known for his eclectic style and high-energy performances, described as "a celebration of life." A young talent who has built a name both nationally and internationally, he has performed at Trix venue in Belgium as part of the CHO & THE CHOSENS event.\n\nHe was featured on The NEXT Podcast (Season 3, Episode 6) alongside DJ ATTI, where they discussed the DJ and party scene in the Netherlands and their career journeys.',
    urls: ['https://www.trixonline.be/en/program/cho-the-chosens/3563/'],
  },
  {
    name: 'Rockefellababe',
    discogsId: 0,
    realName: '',
    country: 'Netherlands',
    genres: ['Dancehall', 'Reggae', 'Afrobeat', 'Hip-Hop'],
    profile: 'Rockefellababe is a DJ and dancehall/reggae artist based in Amsterdam, Netherlands. She has built a strong reputation in the Dutch club and festival circuit for her high-energy sets blending Caribbean, dancehall, afrobeat, urban, and hip-hop sounds.\n\nShe is the founder of "Fidigyaldem," a Caribbean-inspired party concept rooted in the Jamaican phrase meaning "for the girls" — more than a party, it\'s a movement where women can dance freely and own their space.\n\nShe has performed at Mysteryland, Milkshake Festival, Amsterdam Open Air, Freshtival, TivoliVredenburg, Melkweg, and ADE (Amsterdam Dance Event). Her original releases include "Fi Di Gyaldem" (2020), "Pon It" (2021), "Badgyal" (2022), "Energy" (2022, Basshall Records), and "Backshot" (2023).',
    urls: ['https://www.amsterdam-dance-event.nl/en/artists-speakers/rockefellababe/20874/', 'https://kurious.be/artist/rockefellababe/'],
  },
  {
    name: 'Lerato Tsotetsi',
    discogsId: 0,
    realName: 'Lerato Tsotetsi',
    country: 'South Africa',
    genres: ['Afrohouse', 'Amapiano', 'Afrotech'],
    profile: 'Lerato Tsotetsi is a Johannesburg-born, Amsterdam-based DJ who blends her South African roots with contemporary electronic sounds. Her name "Lerato" means "love" in Sesotho. She grew up in Soweto and later lived in northern Johannesburg before calling Amsterdam home.\n\nShe specializes in genre-bending fusions of Afrohouse, Amapiano, and Afrotech, infusing her sets with elements spanning different genres, cultural influences, and musical eras. She is a resident DJ on Oroko Radio, where she produces and hosts her bi-monthly show "Ka Lerato la Love" — an exploration of love through Afrohouse, Amapiano, and Afrotech.\n\nShe has performed at Amsterdam Dance Event (ADE), Paradiso, Parallel, Amsterdam Open Air, Audio Obscura, and various boutique and cultural events.',
    urls: ['https://ra.co/dj/leratotsotetsi', 'https://hoer.live/artist/lerato-tsotetsi-2/'],
  },
  {
    name: 'Heaven Sam',
    discogsId: 0,
    realName: '',
    country: 'Côte d\'Ivoire',
    genres: ['Afrobeat', 'Electronic', 'Soul', 'Funk', 'Dancehall'],
    profile: 'Heaven Sam is a producer, songwriter, artistic director, DJ, and multi-instrumentalist originally from Adzopé, Côte d\'Ivoire (Ivory Coast), now based in France. After years working behind the scenes, he stepped into the spotlight as a performing artist in 2021. His visual trademark is his signature pink hat.\n\nHis musical style is a unique hybrid blending African rhythms, electronic textures, and soul/funk grooves, along with Afro, urban, and electro influences. Since 2016, he has worked alongside major artists including Booba, Naza, and Fally Ipupa.\n\nIn December 2024, he released the collaborative album "Hybride" with DJ Kawest on Juston Records. He has been featured on BBC Radio 1Xtra\'s AfroMEETS Mix and performed at Couleur Café 2025 (Brussels) on the Black Stage.',
    urls: ['https://www.bbc.co.uk/programmes/m002wjx2', 'https://2025.couleurcafe.be/en/line-up/heaven-sam'],
  },
  {
    name: 'Tania Moon',
    discogsId: 0,
    realName: '',
    country: 'Spain',
    genres: ['Deep House', 'Techno', 'Progressive House', 'Afro House', 'Melodic House'],
    profile: 'Tania Moon is a Spanish DJ and electronic music artist from Valencia, Spain. She began DJing at age 15, with her official debut in 2009 at clubs along Spain\'s Costa del Sol. In 2011, she moved to Ibiza to pursue her career full-time.\n\nHer sound is described as elegant, sensitive, and powerful, moving fluidly across deep house, techno, progressive house, Afro house, and melodic house. She held a residency at Pacha Ibiza and Lío Ibiza (2013-2014) as a resident for "So Cool," and has performed at iconic Ibiza venues including Space, Privilege, Destino, Blue Marlin, and Cova Santa. Since 2021, she has held a residency at Sa Trinxa.\n\nShe has performed internationally in Switzerland, Hungary, Italy, and France, and across Spain. She has hosted radio shows on Ibiza Global Radio, Loca FM, and Pure Ibiza Radio, and co-presents the show "Ecoama DJs" with Cristina Molina on Ibiza Global Radio.',
    urls: ['https://djanetop.com/djanes/tania-moon/', 'https://clubbingtv.com/shows/view/3741/'],
  },
  {
    name: 'Marwan Dua',
    discogsId: 0,
    realName: '',
    country: 'Romania',
    genres: ['Deep House', 'Tech House', 'Techno'],
    profile: 'Marwan Dua is a Romanian DJ active in the electronic music scene, performing primarily in the deep house, tech house, and techno genres. He gained recognition through his performances at UNTOLD Festival in Cluj-Napoca, one of Europe\'s biggest electronic music festivals, where he performed on both the Galaxy Stage (techno) and Daydreaming Stage (deep/tech house).\n\nHe was also part of a special collaborative act called "Day Dreamers" alongside Dub FX and Woodnote. He has performed at Neversea Kapital in Bucharest (2025) and continues to build his presence in the Romanian and European electronic music circuit.',
    urls: ['https://www.romaniajournal.ro/spare-time/artists-and-djs-performing-on-untolds-eight-stages-this-year/'],
  },
  {
    name: 'Fonsi Nieto',
    discogsId: 0,
    realName: 'Alfonso Nieto',
    country: 'Spain',
    genres: ['House', 'Electronic'],
    profile: 'Fonsi Nieto is a Spanish DJ and former MotoGP motorcycle racer who transitioned from professional racing to a career in electronic music. His racing number was 10, which became the title and theme of his debut album.\n\nHis debut album "Ten" was released on 7 November 2018 via Clipper\'s Sounds (catalog number CSDA1668). The album features 12+1 tracks with collaborations including David Ros, The Zombie Kids, Chui Kanela, Lexter, and Maartin Rubik. The album is dedicated to his uncle, the legendary Spanish motorcycle racer Ángel Nieto. He has 16+ releases listed on Qobuz.',
    urls: ['https://www.qobuz.com/gb-en/interpreter/fonsi-nieto/1465576', 'https://www.traxsource.com/title/1052995/'],
  },
  {
    name: 'Lucca Van Damme',
    discogsId: 0,
    realName: 'Lucca Van Damme',
    country: 'Belgium',
    genres: ['House', 'Electronic'],
    profile: 'Lucca Van Damme is a Belgian DJ and producer signed to Smash The House, the record label founded by Dimitri Vegas & Like Mike. He is a Tomorrowland Academy success story, having developed his skills through the Academy\'s platform before securing his record deal. He represents the new generation of Belgian electronic music talent emerging through Tomorrowland\'s development programs.',
    urls: ['https://platform.academy.tomorrowland.com/success-stories/lucca-van-damme-signed-with-smash-the-house'],
  },
  {
    name: 'Sebsky',
    discogsId: 0,
    realName: '',
    country: 'Belgium',
    genres: ['Electronic'],
    profile: 'Sebsky is a 14-year-old Belgian DJ who is part of the new generation of electronic music talent emerging from Belgium. He was selected as one of 11 young talents (aged 10-17) to perform at Tomorrowland Belgium 2025 on the Rise Stage, in collaboration with the Tomorrowland Academy. He has also been booked for Retro Classics XXL Festival 2026 and Vijverfestival 2026. Given his young age, he represents the earliest stage of Tomorrowland\'s youth talent development pipeline.',
    urls: [],
  },
  {
    name: 'Sef sansT',
    discogsId: 0,
    realName: 'Sef Daponte',
    country: 'Belgium',
    genres: ['Electronic', 'House'],
    profile: 'Sef sansT (real name: Sef Daponte) is a 17-year-old DJ from Wijnegem, Antwerp, Belgium. His stage name was inspired by Mark with a K — while many people address him as "Stef," the correct pronunciation is "Sef," hence "sans T" (French for "without T"). The name also plays on the word "santé."\n\nHe inherited his passion for music from his father, who is also a DJ, and together they DJ for Redbeats. He reached the semi-finals of MNM Start To DJ 2023 and has performed at Versuz, IKON, and Club Vaag. He also performed for Royal Antwerp Football Club (RAFC) at the Bosuil stadium, including during the Croky Cup Final. His inspirations include James Hype and Fred Again.',
    urls: ['https://vi.be/platform/DjSefsansT'],
  },
  {
    name: 'Wilbert Pigmans',
    discogsId: 0,
    realName: 'Wilbert Pigmans',
    country: 'Netherlands',
    genres: ['NL Pop', 'Party', 'Dance'],
    profile: 'Wilbert Pigmans is a Dutch music artist from the Netherlands, performing primarily in the mainstream pop and Dutch party/dance music scene. His music is characterized by catchy melodies, upbeat rhythms, and relatable lyrics, often featuring humorous or lighthearted themes.\n\nHis most popular track, "De Toreador," was released in 2019 with Opgeblazen and has received multiple remixes including the Crude Intentions Remix on the hardstyle/jumpstyle label RDJ Productions. Other notable tracks include "Raven Is Leven" (a collaboration with DJ Zany & MC DV8), "Kleine Jodeljongen," and "De Clown." He has performed at major Dutch festivals including Emporium, Dreamfields, Freshtival, and Decibel Outdoor.',
    urls: ['https://www.viberate.com/artist/wilbert-pigmans/', 'https://www.junodownload.com/products/opgeblazen-wilbert-pigmans-de-toreador-crude-intentions-remix/5445016-02/'],
  },
  {
    name: 'NORO$T',
    discogsId: 0,
    realName: '',
    country: 'Colombia',
    genres: ['Techno', 'Latin Electronic', 'Guaracha', 'Hard House'],
    profile: 'NORO$T is a producer duo from Bogotá, Colombia, who blend techno and electronic music with contemporary Latin influences. Operating at a distinctive tempo range of 150-165 BPM, they fuse genres like guaracha, reggaeton, house, hard house, and trance with Latin barrio-born rhythms.\n\nThey gained international recognition largely through TikTok, where they remix popular culture songs into high-energy Latin electronic tracks. They founded the "Nasty Club" movement, described as an emerging electronic movement reshaping dance floors worldwide by bridging Colombian identity with international club and festival circuits. They release on the French label Headroom Records (Unity Group network) and have 22+ releases on platforms like Spotify (~66k monthly listeners) and Qobuz.',
    urls: ['https://www.qobuz.com/fi-en/interpreter/norot-1/12706694'],
  },
];

// ===== 主函数 =====

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const djsCollection = db.collection('djs');
  const mapCollection = db.collection('dj_discogs_map');
  console.log('✅ 已连接 MongoDB\n');

  let createdDj = 0;
  let updatedMap = 0;
  let existingDj = 0;

  for (const artist of ARTIST_BIOS) {
    let discogsId = artist.discogsId;

    // 分配 synthetic ID
    if (discogsId === 0) {
      discogsId = nextSyntheticId++;
    }

    // 检查 djs 表是否已有
    const existingDj = await djsCollection.findOne({ discogsId });
    if (existingDj) {
      existingDj++;
      // 更新 profile 如果原来为空
      if (!existingDj.profile || existingDj.profile.length < 50) {
        await djsCollection.updateOne(
          { discogsId },
          { $set: {
              name: artist.name,
              realName: artist.realName || undefined,
              profile: artist.profile,
              country: artist.country,
              genres: artist.genres,
              urls: artist.urls,
              crawledAt: new Date(),
            }
          }
        );
        console.log(`  📝 更新 profile: ${artist.name} (discogs:${discogsId})`);
      } else {
        console.log(`  ⏭️  已有 bio: ${artist.name} (discogs:${discogsId})`);
      }
    } else {
      // 创建新 DJ 文档
      await djsCollection.insertOne({
        discogsId,
        name: artist.name,
        realName: artist.realName || artist.name,
        profile: artist.profile,
        country: artist.country,
        genres: artist.genres,
        styles: artist.genres,
        urls: artist.urls,
        crawledAt: new Date(),
        source: 'web-research',
      });
      createdDj++;
      console.log(`  ✅ 创建 djs: ${artist.name} (discogs:${discogsId})`);
    }

    // 更新 dj_discogs_map 关联
    const key = normKey(artist.name);
    const mapResult = await mapCollection.updateOne(
      { lineupNameKey: key },
      { $set: {
          discogsId,
          discogsName: artist.name,
          status: 'mapped',
          displayGenres: artist.genres,
          source: 'web-research',
        }
      }
    );

    if (mapResult.modifiedCount > 0) {
      updatedMap++;
    }
  }

  console.log('\n═══════════════════════════════════');
  console.log('           写入汇总               ');
  console.log('═══════════════════════════════════');
  console.log(`  ✅ 新建 djs 文档:  ${createdDj}`);
  console.log(`  📝 更新已有 djs:   ${existingDj}`);
  console.log(`  🔗 更新 map 关联:  ${updatedMap}`);
  console.log(`  📊 合计处理:      ${ARTIST_BIOS.length}`);

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
  let withDiscogs = 0, withProfile = 0;

  for (const [key] of artistMap) {
    const map = mapByKey.get(key);
    if (!map) { unmapped++; continue; }
    if (map.status === 'mapped') {
      mapped++;
      if (map.discogsId) {
        withDiscogs++;
        const dj = await djsCollection.findOne({ discogsId: map.discogsId });
        if (dj?.profile && dj.profile.length > 10) withProfile++;
      }
    } else {
      pending++;
    }
  }

  console.log(`\n📈 TML Belgium 最终资料状态:`);
  console.log(`   ✅ 已映射:          ${mapped}/${artistMap.size} (${(mapped/artistMap.size*100).toFixed(1)}%)`);
  console.log(`   📀 有 Discogs ID:   ${withDiscogs}`);
  console.log(`   📝 有 Profile Bio:  ${withProfile}`);
  console.log(`   ⚠️  待审核:          ${pending}`);
  console.log(`   ❌ 无映射:          ${unmapped}`);

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}

main().catch(err => { console.error('失败:', err); process.exit(1); });
