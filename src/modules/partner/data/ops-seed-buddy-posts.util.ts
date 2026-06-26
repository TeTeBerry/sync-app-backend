import type { RaverPersonalityType } from '../../personality-test/personality-test.types';
import type { RecruitUnityTagId } from '@sync/partner-contracts';
import { normalizeRecruitFields } from '../utils/buddy-post-recruit.util';
import { generatePersonalityNickname } from '../../personality-test/utils/personality-nickname.util';
import { generatePersonalityRaverAvatarKey } from '../../personality-test/utils/personality-raver-avatar.util';

export const OPS_SEED_POST_USER_PREFIX = 'ops-seed-';

export const OPS_SEED_ACTIVITY_LEGACY_IDS = [1, 4, 5, 16] as const;

const ACTIVITY_META: Record<
  (typeof OPS_SEED_ACTIVITY_LEGACY_IDS)[number],
  { eventTitle: string; dateLabel: string }
> = {
  1: {
    eventTitle: 'Tomorrowland Thailand 2026',
    dateLabel: '12.11-13',
  },
  4: {
    eventTitle: '风暴电音节 深圳站 2026',
    dateLabel: '06.13-14',
  },
  5: {
    eventTitle: 'EDC Thailand 2026',
    dateLabel: '12.18-20',
  },
  16: {
    eventTitle: 'The Magic Of Tomorrowland 上海 2026',
    dateLabel: '10.17-18',
  },
};

type OpsSeedPostDef = {
  slot: number;
  activityLegacyId: (typeof OPS_SEED_ACTIVITY_LEGACY_IDS)[number];
  personalityType: RaverPersonalityType;
  location: string;
  departureCity: string;
  headcountLabel: string;
  note: string;
  recruitStatus: 'open' | 'full';
  slotsTotal: number;
  slotsFilled: number;
  createdAtOffsetHours: number;
  comments?: number;
  recruitUnityTags?: RecruitUnityTagId[];
};

/** Production ops seed posts — US-Q2-21 cold-start recruit wall. */
const OPS_SEED_POST_DEFS: OpsSeedPostDef[] = [
  // Tomorrowland Thailand (legacyId 1): 2 open + 1 full
  {
    slot: 1,
    activityLegacyId: 1,
    personalityType: 'rager',
    location: '上海',
    departureCity: '上海',
    headcountLabel: '3人',
    note: '主攻 Techno / Melodic，主舞台+副舞台都刷，可拼 Wisdom Valley 附近酒店',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 96,
    recruitUnityTags: ['welcome_newbie', 'multi_day'],
  },
  {
    slot: 2,
    activityLegacyId: 1,
    personalityType: 'connoisseur',
    location: '广州',
    departureCity: '广州',
    headcountLabel: '4人',
    note: 'House / Afro House 向，白天逛夜市晚上冲台，有泰国电话卡，可一起订接机',
    recruitStatus: 'open',
    slotsTotal: 4,
    slotsFilled: 2,
    createdAtOffsetHours: 72,
    recruitUnityTags: ['budget_friendly', 'afterparty_ok'],
  },
  {
    slot: 3,
    activityLegacyId: 1,
    personalityType: 'vibe_curator',
    location: '北京',
    departureCity: '北京',
    headcountLabel: '3人',
    note: '北京 Techno 小队人齐，酒店和接机都定好了，感谢公开回复的朋友们，现场见',
    recruitStatus: 'full',
    slotsTotal: 3,
    slotsFilled: 3,
    createdAtOffsetHours: 120,
    comments: 4,
    recruitUnityTags: ['same_departure', 'pure_rave'],
  },
  // 风暴电音节 深圳 (legacyId 4): 2 open + 1 full
  {
    slot: 4,
    activityLegacyId: 4,
    personalityType: 'zen_raver',
    location: '上海',
    departureCity: '上海',
    headcountLabel: '3人',
    note: 'Progressive / Trance 向，高铁到深圳北，可拼会展中心附近酒店',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 88,
    recruitUnityTags: ['women_friendly', 'budget_friendly'],
  },
  {
    slot: 5,
    activityLegacyId: 4,
    personalityType: 'documentarian',
    location: '广州',
    departureCity: '广州',
    headcountLabel: '2人',
    note: '主看主舞台 Headliner，会带相机记录，欢迎同好一起冲',
    recruitStatus: 'open',
    slotsTotal: 2,
    slotsFilled: 1,
    createdAtOffsetHours: 64,
    recruitUnityTags: ['welcome_newbie', 'pure_rave'],
  },
  {
    slot: 6,
    activityLegacyId: 4,
    personalityType: 'rager',
    location: '深圳',
    departureCity: '深圳',
    headcountLabel: '4人',
    note: '深圳本地小队人齐，宝安接驳和酒店都协调好了，不再加人',
    recruitStatus: 'full',
    slotsTotal: 4,
    slotsFilled: 4,
    createdAtOffsetHours: 108,
    comments: 6,
    recruitUnityTags: ['same_departure', 'early_bird'],
  },
  // EDC Thailand (legacyId 5): 2 open
  {
    slot: 7,
    activityLegacyId: 5,
    personalityType: 'connoisseur',
    location: '上海',
    departureCity: '上海',
    headcountLabel: '3人',
    note: 'Bass / House 向，普吉岛拼房分摊，可曼谷集合后一起飞普吉',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 80,
    recruitUnityTags: ['budget_friendly', 'multi_day'],
  },
  {
    slot: 8,
    activityLegacyId: 5,
    personalityType: 'vibe_curator',
    location: '成都',
    departureCity: '成都',
    headcountLabel: '2人',
    note: '第一次来 EDC 泰国，想组个小队互相照应，差一位，舒服蹦就行',
    recruitStatus: 'open',
    slotsTotal: 2,
    slotsFilled: 1,
    createdAtOffsetHours: 56,
    recruitUnityTags: ['welcome_newbie', 'women_friendly'],
  },
  // TML 上海 (legacyId 16): 2 open
  {
    slot: 9,
    activityLegacyId: 16,
    personalityType: 'zen_raver',
    location: '上海',
    departureCity: '上海',
    headcountLabel: '3人',
    note: 'Melodic / Progressive 向，本地组队，可一起研究交通和住宿方案',
    recruitStatus: 'open',
    slotsTotal: 3,
    slotsFilled: 1,
    createdAtOffsetHours: 48,
    recruitUnityTags: ['same_departure', 'early_bird'],
  },
  {
    slot: 10,
    activityLegacyId: 16,
    personalityType: 'documentarian',
    location: '杭州',
    departureCity: '杭州',
    headcountLabel: '2人',
    note: '杭州出发高铁到上海，主看 Planaxis 舞台，欢迎同好',
    recruitStatus: 'open',
    slotsTotal: 2,
    slotsFilled: 1,
    createdAtOffsetHours: 36,
    recruitUnityTags: ['same_departure', 'welcome_newbie', 'pure_rave'],
  },
];

export const OPS_SEED_POST_COUNT = OPS_SEED_POST_DEFS.length;

function buildOpsSeedPostBody(
  def: Pick<
    OpsSeedPostDef,
    'activityLegacyId' | 'departureCity' | 'headcountLabel' | 'note'
  >,
): string {
  const dateLabel = ACTIVITY_META[def.activityLegacyId].dateLabel;
  return ['组队', dateLabel, def.departureCity, def.headcountLabel, def.note]
    .filter(Boolean)
    .join('，');
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export type OpsSeedBuddyPostSeed = {
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
  recruitUnityTags?: RecruitUnityTagId[];
  status: 'active';
  listedInFeed: true;
  comments: number;
  createdAt: Date;
  recruitStatus: 'open' | 'full';
  slotsTotal: number;
  slotsFilled: number;
};

export function buildOpsSeedBuddyPosts(
  now = new Date(),
): OpsSeedBuddyPostSeed[] {
  return OPS_SEED_POST_DEFS.map((def) => {
    const meta = ACTIVITY_META[def.activityLegacyId];
    const userId = `${OPS_SEED_POST_USER_PREFIX}${String(def.slot).padStart(2, '0')}`;
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
    const body = buildOpsSeedPostBody(def);
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
      activityLegacyId: def.activityLegacyId,
      eventTitle: meta.eventTitle,
      location: def.location,
      departureCity: def.departureCity,
      body,
      bodyPreview: body,
      tags: ['#组队'],
      ...(def.recruitUnityTags?.length
        ? { recruitUnityTags: def.recruitUnityTags }
        : {}),
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
