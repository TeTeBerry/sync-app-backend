import type { PersonalityLineupDj } from '../personality-test.types';

export function lineupDjId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dj(
  name: string,
  genre: string,
  genreLabel: string,
  popularity: number,
  genreColor: string,
): PersonalityLineupDj {
  return {
    id: lineupDjId(name),
    name,
    genre,
    genreLabel,
    stage: 'main',
    popularity,
    genreColor,
  };
}

/** EDC Korea 2026 lineup fallback when schedule API is unavailable. */
export const EDC_KOREA_PERSONALITY_LINEUP: PersonalityLineupDj[] = [
  dj('33 BELOW', 'Bass', 'Dubstep · Bass Music', 84, '#fb7185'),
  dj('4URA', 'Techno', 'Hard Techno', 80, '#c084fc'),
  dj('999999999', 'Techno', 'Industrial Techno · Acid', 88, '#818cf8'),
  dj('ALLEYCVT', 'Dubstep', 'Dubstep · Bass Music', 84, '#fb7185'),
  dj('ALOK', 'House', 'Brazilian Bass · EDM', 93, '#f472b6'),
  dj('ALY & FILA', 'Trance', 'Uplifting Trance', 90, '#38bdf8'),
  dj('ANIME', 'Hardstyle', 'Hardstyle · Hard Dance', 82, '#f97316'),
  dj('ARGY', 'Techno', 'Melodic Techno · House', 87, '#22d3ee'),
  dj('AYYBO', 'House', 'Tech House · Bass House', 85, '#e879f9'),
  dj('BRENNAN HEART', 'Hardstyle', 'Hardstyle', 89, '#f59e0b'),
  dj('CHARLIE SPARKS', 'Techno', 'Hard Techno', 84, '#6366f1'),
  dj('COONE', 'Hardstyle', 'Hardstyle · Rawstyle', 87, '#fbbf24'),
  dj('COSMIC GATE', 'Trance', 'Progressive Trance', 91, '#38bdf8'),
  dj('DIMENSION', 'Drum & Bass', 'D&B · Liquid', 88, '#10b981'),
  dj('DJ SNAKE', 'Trap', 'Trap · EDM', 95, '#ff2d55'),
  dj('FISHER', 'House', 'Tech House', 94, '#84cc16'),
  dj(
    'ILLENIUM B2B DABIN',
    'Dubstep',
    'Melodic Dubstep · Future Bass',
    96,
    '#7b61ff',
  ),
  dj('KAYZO', 'Dubstep', 'Hybrid Trap · Dubstep', 90, '#ef4444'),
  dj('KREAM', 'House', 'Future House · Bass House', 88, '#3b82f6'),
  dj('LILLY PALMER', 'Techno', 'Hard Techno', 86, '#e11d48'),
  dj('NO1 (HONGJOONG)', 'House', 'Open Format · EDM', 80, '#6366f1'),
  dj('R3HAB', 'House', 'Big Room · Electro House', 91, '#facc15'),
  dj('SARA LANDRY', 'Techno', 'Hard Techno · Industrial', 92, '#dc2626'),
  dj('SUBTRONICS', 'Dubstep', 'Riddim · Dubstep', 94, '#84cc16'),
  dj('SVDDEN DEATH', 'Dubstep', 'Brostep · Riddim', 93, '#7c3aed'),
  dj('TIËSTO', 'House', 'Big Room · Progressive House', 98, '#ff2d55'),
  dj('TOKIMONSTA', 'Electronic', 'Future Beats · Hip Hop', 83, '#f472b6'),
  dj('VINI VICI', 'Trance', 'Psytrance · Progressive', 92, '#f59e0b'),
  dj('W&W', 'Big Room', 'Big Room · Electro House', 90, '#3b82f6'),
  dj(
    'WILLIAM BLACK',
    'Future Bass',
    'Melodic Dubstep · Future Bass',
    84,
    '#8b5cf6',
  ),
  dj('WOOLI', 'Dubstep', 'Riddim · Dubstep', 88, '#65a30d'),
];

export type DjSoulProfile = {
  signatureTrack: string;
  spiritMoments: [string, string, string];
  visualSymbol:
    | 'plus'
    | 'sawTeeth'
    | 'waves'
    | 'wings'
    | 'orbits'
    | 'grid'
    | 'bubble'
    | 'mandala'
    | 'waveform';
  primaryColor: string;
  secondaryColor: string;
};

export const DJ_SOUL_PROFILES: Record<string, DjSoulProfile> = {
  tiesto: {
    signatureTrack: 'Red Lights',
    spiritMoments: ['Red Lights', 'Adagio for Strings', '现场烟花'],
    visualSymbol: 'plus',
    primaryColor: '#ff2d55',
    secondaryColor: '#ffffff',
  },
  'w-and-w': {
    signatureTrack: 'Bigfoot',
    spiritMoments: ['Bigfoot', '万人 Jump', '主舞台能量'],
    visualSymbol: 'plus',
    primaryColor: '#3b82f6',
    secondaryColor: '#ff2d55',
  },
  subtronics: {
    signatureTrack: 'Griztronics',
    spiritMoments: ['Griztronics', 'Bass 视觉', '镜头快门'],
    visualSymbol: 'sawTeeth',
    primaryColor: '#84cc16',
    secondaryColor: '#1a1a1a',
  },
  alok: {
    signatureTrack: 'Hear Me Now',
    spiritMoments: ['Hear Me Now', '舞池律动', '社交 BPM'],
    visualSymbol: 'waves',
    primaryColor: '#f472b6',
    secondaryColor: '#facc15',
  },
  'illenium-b2b-dabin': {
    signatureTrack: 'Awake',
    spiritMoments: ['Awake', '情绪共振', '旋律释放'],
    visualSymbol: 'wings',
    primaryColor: '#7b61ff',
    secondaryColor: '#38bdf8',
  },
  'cosmic-gate': {
    signatureTrack: 'Exploration of Space',
    spiritMoments: ['Exploration of Space', '审美标准', 'Trance 叙事'],
    visualSymbol: 'orbits',
    primaryColor: '#38bdf8',
    secondaryColor: '#0ea5e9',
  },
  fisher: {
    signatureTrack: 'Losing It',
    spiritMoments: ['Losing It', 'Oi 梗', '舞池名场面'],
    visualSymbol: 'bubble',
    primaryColor: '#84cc16',
    secondaryColor: '#eab308',
  },
  'sara-landry': {
    signatureTrack: 'Born Slave',
    spiritMoments: ['Born Slave', '工业节拍', '硬核能量'],
    visualSymbol: 'grid',
    primaryColor: '#dc2626',
    secondaryColor: '#1a1a1a',
  },
  'vini-vici': {
    signatureTrack: 'Great Spirit',
    spiritMoments: ['Great Spirit', 'Psy 律动', '迷幻旅程'],
    visualSymbol: 'mandala',
    primaryColor: '#f59e0b',
    secondaryColor: '#ea580c',
  },
  'dj-snake': {
    signatureTrack: 'Turn Down for What',
    spiritMoments: ['Turn Down for What', 'Trap Drop', '全场起跳'],
    visualSymbol: 'sawTeeth',
    primaryColor: '#ff2d55',
    secondaryColor: '#facc15',
  },
};

export const DEFAULT_DJ_SOUL_PROFILE: DjSoulProfile = {
  signatureTrack: 'Mainstage Anthem',
  spiritMoments: ['招牌 Drop', '现场能量', 'Raver 共鸣'],
  visualSymbol: 'waveform',
  primaryColor: '#ff0066',
  secondaryColor: '#7b61ff',
};

export function getDjSoulProfile(djId: string): DjSoulProfile {
  return DJ_SOUL_PROFILES[djId] ?? DEFAULT_DJ_SOUL_PROFILE;
}

export const PERSONALITY_TEST_EVENT = {
  legacyId: 8,
  name: 'EDC Korea 2026',
  dateLabel: '10/03–04',
  location: '仁川 Inspire Entertainment Resort',
  hashtags: ['#EDC2026', '#我的本命DJ', '#电音人格测试'],
} as const;
