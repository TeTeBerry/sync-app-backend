import type { RaverPersonalityType } from '../../personality-test/personality-test.types';
import { normalizeRecruitFields } from '../utils/buddy-post-recruit.util';
import { generatePersonalityNickname } from '../../personality-test/utils/personality-nickname.util';
import { generatePersonalityRaverAvatarKey } from '../../personality-test/utils/personality-raver-avatar.util';

export const TML_THAILAND_LEGACY_ID = 1;
export const TML_THAILAND_EVENT_TITLE = 'Tomorrowland Thailand 2026';
export const DEV_MOCK_TML_POST_USER_PREFIX = 'demo-mock-tml-';

type MockBuddyPostDef = {
  slot: number;
  personalityType: RaverPersonalityType;
  dateLabel: string;
  location: string;
  departureCity: string;
  headcountLabel: string;
  note: string;
  recruitStatus: 'open' | 'full';
  slotsTotal: number;
  slotsFilled: number;
  createdAtOffsetHours: number;
  comments?: number;
};

/** Structured mock posts aligned with US-Q2-16 fields + `buildBuddyPostBody` shape. */
const MOCK_POST_DEFS: MockBuddyPostDef[] = [
  {
    slot: 1,
    personalityType: 'rager',
    dateLabel: '12.11-13',
    location: '上海',
    departureCity: '上海',
    headcountLabel: '3人',
    note: '主攻 Techno / Melodic，主舞台+副舞台都刷，女生优先，可拼 Wisdom Valley 附近酒店',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 96,
  },
  {
    slot: 2,
    personalityType: 'connoisseur',
    dateLabel: '12.11-12',
    location: '广州',
    departureCity: '广州',
    headcountLabel: '4人',
    note: 'House / Afro House 向，白天逛夜市晚上冲台，有泰国电话卡，可一起订接机',
    recruitStatus: 'open',
    slotsTotal: 4,
    slotsFilled: 2,
    createdAtOffsetHours: 72,
  },
  {
    slot: 3,
    personalityType: 'vibe_curator',
    dateLabel: '12.11-13',
    location: '北京',
    departureCity: '北京',
    headcountLabel: '2人',
    note: '第一次来 TML 泰国，想组个小队互相照应，差一位男生，不卷前排，舒服蹦就行',
    recruitStatus: 'open',
    slotsTotal: 2,
    slotsFilled: 1,
    createdAtOffsetHours: 60,
  },
  {
    slot: 4,
    personalityType: 'zen_raver',
    dateLabel: '12.12-13',
    location: '成都',
    departureCity: '成都',
    headcountLabel: '3人',
    note: '已订芭提雅市中心酒店拼房分摊，偏好 Progressive / Trance，不熬夜党勿扰',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 48,
  },
  {
    slot: 5,
    personalityType: 'documentarian',
    dateLabel: '12.11-13',
    location: '深圳',
    departureCity: '深圳',
    headcountLabel: '5人',
    note: '主看 Swedish House Mafia + Martin Garrix，会带相机记录，欢迎同好',
    recruitStatus: 'open',
    slotsTotal: 5,
    slotsFilled: 2,
    createdAtOffsetHours: 36,
  },
  {
    slot: 6,
    personalityType: 'rager',
    dateLabel: '12.11',
    location: '杭州',
    departureCity: '杭州',
    headcountLabel: '3人',
    note: 'Techno 同好优先，单日票也可聊，可曼谷集合后一起包车去芭提雅',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 24,
  },
  {
    slot: 7,
    personalityType: 'connoisseur',
    dateLabel: '12.11-13',
    location: '上海',
    departureCity: '上海',
    headcountLabel: '3人',
    note: '上海 Techno 小队人齐，酒店和接机都定好了，感谢公开回复的朋友们，现场见',
    recruitStatus: 'full',
    slotsTotal: 3,
    slotsFilled: 3,
    createdAtOffsetHours: 120,
    comments: 5,
  },
  {
    slot: 8,
    personalityType: 'vibe_curator',
    dateLabel: '12.11-12',
    location: '广州',
    departureCity: '广州',
    headcountLabel: '2人',
    note: '广州 House 小队组满封帖，不再加人啦',
    recruitStatus: 'full',
    slotsTotal: 2,
    slotsFilled: 2,
    createdAtOffsetHours: 108,
    comments: 3,
  },
  {
    slot: 9,
    personalityType: 'zen_raver',
    dateLabel: '12.11-13',
    location: '北京',
    departureCity: '北京',
    headcountLabel: '4人',
    note: '北京小分队组满，主舞台前排+烟花位都协调好了，谢谢大家',
    recruitStatus: 'full',
    slotsTotal: 4,
    slotsFilled: 4,
    createdAtOffsetHours: 84,
    comments: 8,
  },
  {
    slot: 10,
    personalityType: 'documentarian',
    dateLabel: '12.12-13',
    location: '成都',
    departureCity: '成都',
    headcountLabel: '2人',
    note: '副舞台 Deep House 专线，人齐了不再招募',
    recruitStatus: 'full',
    slotsTotal: 2,
    slotsFilled: 2,
    createdAtOffsetHours: 72,
    comments: 2,
  },
  {
    slot: 11,
    personalityType: 'rager',
    dateLabel: '12.11-13',
    location: '武汉',
    departureCity: '武汉',
    headcountLabel: '3人',
    note: '武汉 Techno 小队人齐，曼谷接机+酒店都安排好了，公开回复的朋友现场见',
    recruitStatus: 'full',
    slotsTotal: 3,
    slotsFilled: 3,
    createdAtOffsetHours: 132,
    comments: 6,
  },
  {
    slot: 12,
    personalityType: 'connoisseur',
    dateLabel: '12.11-12',
    location: '西安',
    departureCity: '西安',
    headcountLabel: '4人',
    note: '西安 Melodic 向四人小队人齐，副舞台+烟花区行程已定，不再加人',
    recruitStatus: 'full',
    slotsTotal: 4,
    slotsFilled: 4,
    createdAtOffsetHours: 114,
    comments: 4,
  },
  {
    slot: 13,
    personalityType: 'vibe_curator',
    dateLabel: '12.12',
    location: '南京',
    departureCity: '南京',
    headcountLabel: '2人',
    note: '南京出发单日票小队人齐，芭提雅往返包车已订，封帖啦',
    recruitStatus: 'full',
    slotsTotal: 2,
    slotsFilled: 2,
    createdAtOffsetHours: 102,
    comments: 3,
  },
];

export const DEV_MOCK_TML_POST_COUNT = MOCK_POST_DEFS.length;

function buildMockBuddyPostBody(
  def: Pick<
    MockBuddyPostDef,
    'dateLabel' | 'departureCity' | 'headcountLabel' | 'note'
  >,
): string {
  return [
    '组队',
    def.dateLabel,
    def.departureCity,
    def.headcountLabel,
    def.note,
  ]
    .filter(Boolean)
    .join('，');
}

/** Deterministic pseudo-random for stable dev nicknames across restarts. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export type DevMockBuddyPostSeed = {
  userId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  activityLegacyId: number;
  eventTitle: string;
  location: string;
  departureCity: string;
  body: string;
  bodyPreview: string;
  tags: string[];
  status: 'active';
  listedInFeed: true;
  comments: number;
  createdAt: Date;
  recruitStatus: 'open' | 'full';
  slotsTotal: number;
  slotsFilled: number;
};

export function buildDevMockTmlBuddyPosts(
  now = new Date(),
): DevMockBuddyPostSeed[] {
  return MOCK_POST_DEFS.map((def) => {
    const userId = `${DEV_MOCK_TML_POST_USER_PREFIX}${String(def.slot).padStart(2, '0')}`;
    const nickname = generatePersonalityNickname(
      def.personalityType,
      seededRandom(def.slot * 9973),
    );
    const avatarKey = generatePersonalityRaverAvatarKey(
      seededRandom(def.slot * 7919),
    );
    const createdAt = new Date(
      now.getTime() - def.createdAtOffsetHours * 60 * 60 * 1000,
    );
    const body = buildMockBuddyPostBody(def);
    const recruit = normalizeRecruitFields({
      recruitStatus: def.recruitStatus,
      slotsTotal: def.slotsTotal,
      slotsFilled: def.slotsFilled,
      body,
    });

    return {
      userId,
      authorName: nickname,
      authorHandle: `@${userId}`,
      authorAvatar: avatarKey,
      activityLegacyId: TML_THAILAND_LEGACY_ID,
      eventTitle: TML_THAILAND_EVENT_TITLE,
      location: def.location,
      departureCity: def.departureCity,
      body,
      bodyPreview: body,
      tags: ['#组队'],
      status: 'active',
      listedInFeed: true,
      comments: def.comments ?? 0,
      createdAt,
      recruitStatus: recruit.recruitStatus,
      slotsTotal: recruit.slotsTotal!,
      slotsFilled: recruit.slotsFilled!,
    };
  });
}
