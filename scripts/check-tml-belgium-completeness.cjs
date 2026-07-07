/**
 * 查询 Tomorrowland Belgium (activityLegacyId=7) 艺人资料完整度
 * 用法: cd sync-app-backend && node scripts/check-tml-belgium-completeness.cjs
 */

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/sync-ai';
const TML_BELGIUM_ID = 7;

const WEAK_GENRES = new Set(['electronic', 'dance', 'edm', 'pop', 'unknown']);

/** 规范化名字: "Dimitri Vegas & Like Mike" → "dimitrivegaslikemike" (用于匹配 lineupNameKey) */
function normKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** 规范化名字: "Dimitri Vegas & Like Mike" → "dimitri vegas & like mike" (用于匹配 avatar artistNameKey) */
function normSpaced(name) {
  return (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasWeakGenresOnly(arr) {
  const all = arr || [];
  if (!all.length) return true;
  return all.every((g) => WEAK_GENRES.has((g || '').toLowerCase()));
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ 已连接 MongoDB\n');

  const db = mongoose.connection.db;

  // ─── 1. 获取 TML Belgium 所有艺人 ───
  const performances = await db
    .collection('artist_performances')
    .find({ activityLegacyId: TML_BELGIUM_ID })
    .toArray();

  // 去重
  const artistMap = new Map();
  for (const p of performances) {
    const key = normKey(p.artistName);
    if (!artistMap.has(key)) {
      artistMap.set(key, p);
    }
  }
  const artists = [...artistMap.values()];
  const total = artists.length;

  console.log(`📊 Tomorrowland Belgium (activityLegacyId=${TML_BELGIUM_ID})`);
  console.log(`   总艺人数 (去重): ${total}`);
  console.log(`   演出场次 (含多舞台): ${performances.length}\n`);

  // ─── 2. 加载全部参考数据 ───
  const [allDiscogsMaps, allAvatars, allDjs] = await Promise.all([
    db.collection('dj_discogs_map').find({}).toArray(),
    db.collection('lineup_artist_avatars').find({}).toArray(),
    db.collection('djs').find({}).toArray(),
  ]);

  const discogsByKey = new Map(allDiscogsMaps.map((d) => [d.lineupNameKey, d]));
  const avatarByKey = new Map(allAvatars.map((a) => [a.artistNameKey, a]));
  const djByDiscogsId = new Map(allDjs.map((d) => [d.discogsId, d]));

  console.log(`   dj_discogs_map 总数: ${allDiscogsMaps.length}`);
  console.log(`   djs 总数: ${allDjs.length}`);
  console.log(`   avatars 总数: ${allAvatars.length}\n`);

  // ─── 3. 分析每个艺人 ───
  const stats = {
    total,
    complete: 0,           // 资料齐全
    hasDiscogsMapped: 0,   // dj_discogs_map.status === 'mapped'
    pendingReview: 0,      // dj_discogs_map.status === 'pending_review'
    unmapped: 0,           // 在 dj_discogs_map 中完全找不到
    missingProfile: 0,     // djs.profile 为空或太短
    noDjRecord: 0,         // 有 discogsId 但 djs 中无记录
    weakGenre: 0,          // 流派只有 generic (electronic/dance/edm/pop)
    noGenre: 0,            // 完全无流派
    missingAvatar: 0,      // 无头像
    hasTrustedProfile: 0,  // profile 存在且可信
  };

  const incompleteList = [];
  const completeList = [];

  for (const artist of artists) {
    const normalizedKey = normKey(artist.artistName);
    const map = discogsByKey.get(normalizedKey);
    const dj = map?.discogsId ? djByDiscogsId.get(map.discogsId) : null;
    const avatar = avatarByKey.get(normSpaced(artist.artistName));

    const issues = [];

    // Discogs 映射状态
    const mapStatus = map?.status || 'none';

    if (!map) {
      stats.unmapped++;
      issues.push('无 Discogs 映射');
    } else if (mapStatus === 'pending_review') {
      stats.pendingReview++;
      issues.push('Discogs 待审核');
    } else if (mapStatus === 'mapped') {
      stats.hasDiscogsMapped++;
    }

    // 流派检查
    const allGenres = [
      ...(map?.displayGenres || []),
      ...(map?.displayStyles || []),
      artist.genre,
      artist.genreLabel,
    ].filter((g) => g && g !== 'Unknown' && g !== '风格待补充');
    const uniqueGenres = [...new Set(allGenres)];

    if (uniqueGenres.length === 0) {
      stats.noGenre++;
      issues.push('无流派');
    } else if (hasWeakGenresOnly(uniqueGenres)) {
      stats.weakGenre++;
      issues.push('流派弱(' + uniqueGenres.slice(0, 3).join(', ') + ')');
    }

    // DJ 档案 (profile)
    let hasProfile = false;
    if (dj?.profile && dj.profile.length > 10) {
      hasProfile = true;
      stats.hasTrustedProfile++;
    } else if (map?.discogsId && !dj) {
      stats.noDjRecord++;
      issues.push('有 discogsId 但无 DJ 记录');
    } else if (dj && (!dj.profile || dj.profile.length <= 10)) {
      stats.missingProfile++;
      issues.push('无详细档案');
    } else if (!map || !map.discogsId) {
      stats.missingProfile++;
      issues.push('无 Discogs 映射→无档案');
    }

    // 头像
    let hasAvatar = false;
    if (avatar?.avatarUrl && avatar.avatarUrl.length > 0) {
      hasAvatar = true;
    } else {
      stats.missingAvatar++;
      issues.push('无头像');
    }

    const info = {
      artistId: artist.artistId,
      artistName: artist.artistName,
      genre: artist.genreLabel || artist.genre || '',
      discogsId: map?.discogsId || '',
      discogsName: map?.discogsName || '',
      mapStatus,
      hasProfile,
      hasAvatar,
      displayGenres: map?.displayGenres || [],
      displayStyles: map?.displayStyles || [],
      djCountry: dj?.country || '',
      issues,
    };

    if (issues.length === 0) {
      stats.complete++;
      completeList.push(info);
    } else {
      incompleteList.push(info);
    }
  }

  // ─── 4. 输出报告 ───
  console.log('══════════════════════════════════════════════');
  console.log('        📋 TML Belgium 艺人资料完整度         ');
  console.log('══════════════════════════════════════════════\n');

  const pct = (n) => ((n / total) * 100).toFixed(1) + '%';

  console.log('─── 映射状态 ───');
  console.log(`   ✅ Discogs 已映射 (mapped):   ${stats.hasDiscogsMapped}\t${pct(stats.hasDiscogsMapped)}`);
  console.log(`   ⚠️  Discogs 待审核:           ${stats.pendingReview}\t${pct(stats.pendingReview)}`);
  console.log(`   ❌ 无 Discogs 映射:           ${stats.unmapped}\t${pct(stats.unmapped)}`);

  console.log('\n─── 流派状态 ───');
  console.log(`   ⚠️  流派太泛 (弱流派):        ${stats.weakGenre}\t${pct(stats.weakGenre)}`);
  console.log(`   ❌ 完全无流派:               ${stats.noGenre}\t${pct(stats.noGenre)}`);

  console.log('\n─── 档案状态 ───');
  console.log(`   ✅ 有可信档案 (profile):     ${stats.hasTrustedProfile}\t${pct(stats.hasTrustedProfile)}`);
  console.log(`   ❌ 无详细档案:               ${stats.missingProfile}\t${pct(stats.missingProfile)}`);
  console.log(`   ❌ discogsId→djs 断链:       ${stats.noDjRecord}\t${pct(stats.noDjRecord)}`);

  console.log('\n─── 头像状态 ───');
  console.log(`   ❌ 无头像:                   ${stats.missingAvatar}\t${pct(stats.missingAvatar)}`);

  const incomplete = total - stats.complete;
  console.log('\n══════════════════════════════════════════════');
  console.log(`   ✅ 资料齐全:    ${stats.complete}\t${pct(stats.complete)}`);
  console.log(`   🔴 资料不完整:  ${incomplete}\t${pct(incomplete)}`);
  console.log('══════════════════════════════════════════════');

  // ─── 5. 不完整艺人分类统计 ───
  // 按主要问题分类
  const byIssue = {
    unmapped: incompleteList.filter((a) => !a.discogsId),
    pendingReview: incompleteList.filter((a) => a.mapStatus === 'pending_review'),
    mappedButNoProfile: incompleteList.filter((a) => a.discogsId && a.mapStatus === 'mapped' && !a.hasProfile),
    mappedButWeakGenre: incompleteList.filter((a) => a.discogsId && a.mapStatus === 'mapped' && a.hasProfile && a.issues.some((i) => i.includes('流派'))),
    mappedButNoAvatar: incompleteList.filter((a) => a.discogsId && a.mapStatus === 'mapped' && a.hasProfile && a.issues.length === 1 && a.issues[0].includes('无头像')),
  };

  console.log('\n─── 问题分类统计 ───');
  console.log(`   ❌ 完全无映射:             ${byIssue.unmapped.length}`);
  console.log(`   ⚠️  待审核:                ${byIssue.pendingReview.length}`);
  console.log(`   ⚠️  已映射但缺档案:        ${byIssue.mappedButNoProfile.length}`);
  console.log(`   ⚠️  已映射有档案但流派弱:   ${byIssue.mappedButWeakGenre.length}`);
  console.log(`   ⚠️  仅缺头像 (其他齐全):    ${byIssue.mappedButNoAvatar.length}`);

  // ─── 6. 不完整艺人详情 (按严重度排序) ───
  if (incompleteList.length > 0) {
    // 严重度排序: 无映射 > 待审核 > 缺档案 > 流派弱 > 仅缺头像
    const severity = (a) => {
      if (!a.discogsId) return 0;
      if (a.mapStatus === 'pending_review') return 1;
      if (!a.hasProfile) return 2;
      if (a.issues.some((i) => i.includes('流派'))) return 3;
      return 4;
    };
    incompleteList.sort((a, b) => severity(a) - severity(b));

    console.log(`\n─── 资料不完整艺人详情 (${incompleteList.length} 位) ───\n`);

    for (const d of incompleteList) {
      const sev = severity(d);
      const icon = sev === 0 ? '🔴' : sev === 1 ? '🟡' : sev <= 2 ? '🟠' : '🟢';
      console.log(`${icon} ${d.artistName}`);
      if (d.genre) console.log(`   Genre: ${d.genre}`);
      if (d.displayGenres.length || d.displayStyles.length) {
        console.log(`   Display: ${[...d.displayGenres, ...d.displayStyles].join(', ')}`);
      }
      if (d.discogsId) {
        console.log(`   Discogs: ${d.discogsId} ${d.discogsName ? '(' + d.discogsName + ')' : ''} [${d.mapStatus}]`);
      } else {
        console.log(`   Discogs: ❌ 无映射`);
      }
      if (d.djCountry) console.log(`   Country: ${d.djCountry}`);
      console.log(`   Profile: ${d.hasProfile ? '✅' : '❌'}  |  Avatar: ${d.hasAvatar ? '✅' : '❌'}`);
      console.log(`   Issues: ${d.issues.join(' | ')}`);
      console.log();
    }
  }

  // ─── 7. 资料齐全艺人 ───
  if (completeList.length > 0) {
    console.log(`─── 资料齐全艺人 (${completeList.length} 位) ───`);
    for (const d of completeList) {
      const genres = [...d.displayGenres, ...d.displayStyles].filter(Boolean);
      console.log(`  ✅ ${d.artistName}  |  ${genres.slice(0, 3).join(', ') || d.genre}  |  discogs:${d.discogsId}  ${d.discogsName ? '(' + d.discogsName + ')' : ''}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ 完成');
}

main().catch((err) => {
  console.error('查询失败:', err);
  process.exit(1);
});
