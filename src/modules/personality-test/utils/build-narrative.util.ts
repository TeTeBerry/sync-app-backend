import type { PersonalityTypeMeta } from '../data/personality-types';
import { PERSONALITY_TYPE_META } from '../data/personality-types';
import type {
  PersonalityEventRecommendation,
  PersonalityNarrative,
  PersonalityScoreResult,
  RaverPersonalityType,
  RecommendDjLineupResult,
} from '../personality-test.types';

export const ANALYSIS: Record<RaverPersonalityType, string> = {
  rager:
    '你追求极致的能量释放，相信音乐是集体狂欢的催化剂。你不在乎编曲拆解，你在乎 drop 下来的那一刻，全场和你一起甩头的共鸣。',
  connoisseur:
    '你把 set 当作完整作品来听，在意制作人的叙事与音色选择。你宁愿错过主舞台 hype，也不愿错过一段真正打动你的 progression。',
  vibe_curator:
    '现场对你来说是社交场，音乐是让大家靠近彼此的背景。你记得的不只是 drop，还有霓虹灯下那些一起笑、一起跳的面孔。',
  zen_raver:
    '你不抢前排，不追 hype，在人群里保留自己的节奏。你享受的是氛围本身——灯光、风声、和陌生人一起安静听完一首歌的感动。',
  documentarian:
    '手机是你的第二双眼，drop 是你的剪辑点。你不只是参与者，也是传播者——把现场能量装进 15 秒，让更多人感受到那一刻。',
};

export function buildPersonalityNarrative(
  score: PersonalityScoreResult,
  recommendations: RecommendDjLineupResult,
  recommendedEvents: PersonalityEventRecommendation[],
  typeMeta: Record<
    RaverPersonalityType,
    PersonalityTypeMeta
  > = PERSONALITY_TYPE_META,
): PersonalityNarrative {
  const primary = typeMeta[score.primaryType];
  const secondary = score.secondaryType ? typeMeta[score.secondaryType] : null;

  const tagline = secondary
    ? `${primary.emoji} ${primary.label} × ${secondary.label}`
    : `${primary.emoji} ${primary.label}`;

  const blendNote = score.blendRatio
    ? `你的人格构成约 ${score.blendRatio.primary}% ${primary.label}、${score.blendRatio.secondary}% ${secondary?.label ?? '其他'}，现场会同时在意能量与审美。`
    : '';

  const genreNote = `偏好曲风：${primary.genreTags.join(' · ')}。`;

  const soulName = recommendations.soulMatch.djName;
  const lineupEvent = recommendedEvents.find(
    (event) => event.matchedDjs.length > 0,
  );
  const eventNote = lineupEvent
    ? lineupEvent.matchedDjs.includes(soulName)
      ? `「${lineupEvent.name}」阵容已官宣，含你的本命 DJ ${soulName}。`
      : `「${lineupEvent.name}」阵容已官宣，含 ${lineupEvent.matchedDjs.slice(0, 2).join('、')} 等你偏好的艺人。`
    : '可前往活动页浏览更多场次，阵容公布后会再为你匹配。';

  const aiAnalysis = [
    ANALYSIS[score.primaryType],
    blendNote,
    genreNote,
    `与你灵魂最接近的 DJ 是 ${soulName}（匹配度 ${recommendations.soulMatch.matchScore}%）。`,
    eventNote,
  ]
    .filter(Boolean)
    .join('\n');

  const soulNameKey = soulName.trim().toLowerCase();
  const alignedDjs = recommendations.mustSee
    .filter((item) => item.djName.trim().toLowerCase() !== soulNameKey)
    .slice(0, 2);

  const spiritConnections = [
    { role: 'soul' as const, djName: soulName },
    ...alignedDjs.map((item) => ({
      role: 'aligned' as const,
      djName: item.djName,
    })),
  ];

  return {
    tagline,
    aiAnalysis,
    spiritConnections,
  };
}
