import type { RaverPersonalityType } from '../../personality-test/personality-test.types';
import { generatePersonalityNickname } from '../../personality-test/utils/personality-nickname.util';
import { generatePersonalityRaverAvatarKey } from '../../personality-test/utils/personality-raver-avatar.util';

export const TML_THAILAND_LEGACY_ID = 1;
export const TML_THAILAND_EVENT_TITLE = 'Tomorrowland Thailand 2026';
export const DEV_MOCK_TML_POST_USER_PREFIX = 'demo-mock-tml-';

type MockBuddyPostDef = {
  slot: number;
  personalityType: RaverPersonalityType;
  body: string;
  location: string;
  departureCity: string;
  createdAtOffsetHours: number;
  comments?: number;
};

/** Dev mock posts: body 含 1/3、2/4 → 招募中；含 已满/招满 + 满额分数 → 组队已满。 */
const MOCK_POST_DEFS: MockBuddyPostDef[] = [
  {
    slot: 1,
    personalityType: 'rager',
    body: '招募中｜12.11-13 TML 泰国，上海出发飞曼谷。主攻 Techno / Melodic，主舞台+副舞台都刷。目前 1/3，还差两位，女生优先，可拼 Wisdom Valley 附近酒店。',
    location: '上海',
    departureCity: '上海',
    createdAtOffsetHours: 96,
  },
  {
    slot: 2,
    personalityType: 'connoisseur',
    body: '组队招募｜12.11-12 芭提雅，广州出发。House / Afro House 向，白天逛夜市晚上冲台。2/4 还缺两人，有泰国电话卡，可一起订接机。',
    location: '广州',
    departureCity: '广州',
    createdAtOffsetHours: 72,
  },
  {
    slot: 3,
    personalityType: 'vibe_curator',
    body: '找同行去 Wisdom Valley｜北京出发 12.11-13，第一次来 TML 泰国，想组个小队互相照应。1/2，差一位男生，不卷前排，舒服蹦就行。',
    location: '北京',
    departureCity: '北京',
    createdAtOffsetHours: 60,
  },
  {
    slot: 4,
    personalityType: 'zen_raver',
    body: '成都出发，12.12-13 两天场。已订芭提雅市中心酒店，招 2-3 人拼房分摊。偏好 Progressive / Trance，不熬夜党勿扰。',
    location: '成都',
    departureCity: '成都',
    createdAtOffsetHours: 48,
  },
  {
    slot: 5,
    personalityType: 'documentarian',
    body: '深圳小分队招募｜12.11-13 全程，主看 Swedish House Mafia + Martin Garrix。目前 2/5，还缺三人，会带相机记录，欢迎同好。',
    location: '深圳',
    departureCity: '深圳',
    createdAtOffsetHours: 36,
  },
  {
    slot: 6,
    personalityType: 'rager',
    body: '杭州出发｜12.11 单日票也可聊。Techno 同好优先，1/3，可曼谷集合后一起包车去芭提雅，行程好商量。',
    location: '杭州',
    departureCity: '杭州',
    createdAtOffsetHours: 24,
  },
  {
    slot: 7,
    personalityType: 'connoisseur',
    body: '组队已满｜12.11-13，上海 Techno 小队 3/3 人齐，酒店和接机都定好了。感谢公开回复的朋友们，现场见！',
    location: '上海',
    departureCity: '上海',
    createdAtOffsetHours: 120,
    comments: 5,
  },
  {
    slot: 8,
    personalityType: 'vibe_curator',
    body: '已满员｜广州出发 House 小队 2/2，12.11-12 芭提雅。组满封帖，不再加人啦。',
    location: '广州',
    departureCity: '广州',
    createdAtOffsetHours: 108,
    comments: 3,
  },
  {
    slot: 9,
    personalityType: 'zen_raver',
    body: '招满｜北京 4 人小分队 4/4，12.11-13 全程。主舞台前排+烟花位都协调好了，组队成功，谢谢大家。',
    location: '北京',
    departureCity: '北京',
    createdAtOffsetHours: 84,
    comments: 8,
  },
  {
    slot: 10,
    personalityType: 'documentarian',
    body: '组队已满｜成都出发 2/2，12.12-13 两天。副舞台 Deep House 专线，人齐了不再招募。',
    location: '成都',
    departureCity: '成都',
    createdAtOffsetHours: 72,
    comments: 2,
  },
];

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
    const bodyPreview = def.body;

    return {
      userId,
      authorName: nickname,
      authorHandle: `@${userId}`,
      authorAvatar: avatarKey,
      activityLegacyId: TML_THAILAND_LEGACY_ID,
      eventTitle: TML_THAILAND_EVENT_TITLE,
      location: def.location,
      departureCity: def.departureCity,
      body: def.body,
      bodyPreview,
      tags: ['#组队'],
      status: 'active',
      listedInFeed: true,
      comments: def.comments ?? 0,
      createdAt,
    };
  });
}
