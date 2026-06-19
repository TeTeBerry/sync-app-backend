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
};

const MOCK_POST_DEFS: MockBuddyPostDef[] = [
  {
    slot: 1,
    personalityType: 'rager',
    body: '组队，12.11-13，上海，2人，想找 Techno 搭子',
    location: '上海',
    departureCity: '上海',
    createdAtOffsetHours: 72,
  },
  {
    slot: 2,
    personalityType: 'connoisseur',
    body: '组队，12.11-13，广州，3人，芭提雅可拼房',
    location: '广州',
    departureCity: '广州',
    createdAtOffsetHours: 48,
  },
  {
    slot: 3,
    personalityType: 'vibe_curator',
    body: '组队，12.11-12，北京，1人，女生优先',
    location: '北京',
    departureCity: '北京',
    createdAtOffsetHours: 36,
  },
  {
    slot: 4,
    personalityType: 'zen_raver',
    body: '组队，12.12-13，成都，2人，一起飞曼谷',
    location: '成都',
    departureCity: '成都',
    createdAtOffsetHours: 24,
  },
  {
    slot: 5,
    personalityType: 'documentarian',
    body: '组队，12.11-13，深圳，4人，酒店已定 Wisdom Valley 附近',
    location: '深圳',
    departureCity: '深圳',
    createdAtOffsetHours: 12,
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
      tags: ['#组队'],
      status: 'active',
      listedInFeed: true,
      comments: 0,
      createdAt,
    };
  });
}
