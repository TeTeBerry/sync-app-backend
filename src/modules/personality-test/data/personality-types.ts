import type {
  MatchDimension,
  RaverPersonalityType,
} from '../personality-test.types';

export type PersonalityTypeMeta = {
  type: RaverPersonalityType;
  emoji: string;
  label: string;
  labelEn: string;
  description: string;
  genreTags: string[];
  primaryColor: string;
  targetVector: Record<MatchDimension, number>;
  dimensionWeights: Record<MatchDimension, number>;
};

export const RAVER_PERSONALITY_TYPES: RaverPersonalityType[] = [
  'rager',
  'connoisseur',
  'vibe_curator',
  'zen_raver',
  'documentarian',
];

export const PERSONALITY_TYPE_META: Record<
  RaverPersonalityType,
  PersonalityTypeMeta
> = {
  rager: {
    type: 'rager',
    emoji: '🔥',
    label: '主舞台拳皇',
    labelEn: 'The Rager',
    description: '追求能量、前排战士',
    genreTags: ['Big Room', 'Hardstyle', 'Dubstep'],
    primaryColor: '#ff2d55',
    targetVector: { E: 90, M: 20, S: 70, C: 95 },
    dimensionWeights: { E: 0.4, M: 0.1, S: 0.25, C: 0.25 },
  },
  connoisseur: {
    type: 'connoisseur',
    emoji: '🧠',
    label: '副舞台探索者',
    labelEn: 'The Connoisseur',
    description: '懂音乐、品味优先',
    genreTags: ['Techno', 'Trance', 'Progressive'],
    primaryColor: '#7b61ff',
    targetVector: { E: 50, M: 90, S: 25, C: 40 },
    dimensionWeights: { E: 0.15, M: 0.45, S: 0.15, C: 0.25 },
  },
  vibe_curator: {
    type: 'vibe_curator',
    emoji: '🎭',
    label: '气氛组选手',
    labelEn: 'The Vibe Curator',
    description: '爱拍照、重社交',
    genreTags: ['Tech House', 'Brazilian Bass', 'House'],
    primaryColor: '#ff4d94',
    targetVector: { E: 65, M: 40, S: 95, C: 60 },
    dimensionWeights: { E: 0.2, M: 0.1, S: 0.45, C: 0.25 },
  },
  zen_raver: {
    type: 'zen_raver',
    emoji: '🧘',
    label: '后排养老型',
    labelEn: 'The Zen Raver',
    description: '享受氛围、佛系参与',
    genreTags: ['Melodic Bass', 'Future Beats', 'Chill'],
    primaryColor: '#34d399',
    targetVector: { E: 20, M: 55, S: 35, C: 20 },
    dimensionWeights: { E: 0.35, M: 0.2, S: 0.15, C: 0.3 },
  },
  documentarian: {
    type: 'documentarian',
    emoji: '📸',
    label: '内容创作者',
    labelEn: 'The Documentarian',
    description: '录视频、传播者',
    genreTags: ['Bass', 'Visual', 'Trap'],
    primaryColor: '#84cc16',
    targetVector: { E: 75, M: 50, S: 80, C: 70 },
    dimensionWeights: { E: 0.3, M: 0.15, S: 0.35, C: 0.2 },
  },
};

export function getPersonalityMeta(
  type: RaverPersonalityType,
): PersonalityTypeMeta {
  return PERSONALITY_TYPE_META[type];
}
