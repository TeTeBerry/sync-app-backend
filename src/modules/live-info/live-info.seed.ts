import type { LiveInfoCategoryId } from './domain/live-info-categories';

export type LiveInfoSeedUpdate = {
  activityLegacyId: number;
  userId: string;
  authorName: string;
  avatar?: string;
  zoneTag?: string;
  ratings: { categoryId: LiveInfoCategoryId; score: number }[];
  remark: string;
  likedByUserIds?: string[];
  /** Stagger feed time labels in demo */
  minutesAgo?: number;
};

/** Demo feed for 风暴电音节 (activity legacyId 4). */
export const LIVE_INFO_SEED_UPDATES: LiveInfoSeedUpdate[] = [
  {
    activityLegacyId: 4,
    userId: 'demo-ryan',
    authorName: '深圳老炮',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    minutesAgo: 2,
    zoneTag: 'stage_a',
    ratings: [
      { categoryId: 'entry_crowd', score: 4 },
      { categoryId: 'smoke_drink', score: 3 },
      { categoryId: 'sound_level', score: 4 },
    ],
    remark: '只查包不查身，北门比南门好进，主舞台这边人最多',
    likedByUserIds: ['demo-zara', 'demo-luna'],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-luna',
    authorName: 'Luna',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
    minutesAgo: 8,
    zoneTag: 'stage_b',
    ratings: [
      { categoryId: 'toilet_queue', score: 5 },
      { categoryId: 'water_queue', score: 4 },
      { categoryId: 'stage_view', score: 3 },
    ],
    remark: 'B区厕所排了快半小时，女生队更长；补水点只有主通道两个在出水',
    likedByUserIds: ['demo-mia'],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-mia',
    authorName: '现场小白',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
    minutesAgo: 15,
    zoneTag: 'venue',
    ratings: [
      { categoryId: 'entry_crowd', score: 2 },
      { categoryId: 'toilet_queue', score: 2 },
      { categoryId: 'water_queue', score: 2 },
      { categoryId: 'smoke_drink', score: 2 },
    ],
    remark: '下午三点入场很顺，整体不算挤，安检基本不用排队',
    likedByUserIds: [],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-kyle',
    authorName: '蹦迪选手阿凯',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
    minutesAgo: 22,
    zoneTag: 'stage_a',
    ratings: [
      { categoryId: 'entry_crowd', score: 5 },
      { categoryId: 'smoke_drink', score: 4.5 },
      { categoryId: 'toilet_queue', score: 3.5 },
      { categoryId: 'stage_view', score: 4 },
    ],
    remark: '南门刚限流，建议走西侧员工通道旁边的散客口，十分钟挪一步',
    likedByUserIds: ['demo-ryan', 'demo-kyle', 'demo-zara'],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-alex',
    authorName: '啤酒爱好者',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
    minutesAgo: 31,
    zoneTag: 'vip_booth',
    ratings: [
      { categoryId: 'smoke_drink', score: 1 },
      { categoryId: 'water_queue', score: 1 },
      { categoryId: 'sound_level', score: 2 },
    ],
    remark: '安检区很空，入场很快；免费饮水台在医疗帐篷旁边',
    likedByUserIds: [],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-suki',
    authorName: '小雨',
    avatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80',
    minutesAgo: 38,
    zoneTag: 'vip_booth',
    ratings: [
      { categoryId: 'toilet_queue', score: 4 },
      { categoryId: 'stage_view', score: 5 },
    ],
    remark: 'VIP 通道畅通，普通口要排二十分钟左右；厕所纸快没了',
    likedByUserIds: ['demo-luna'],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-nico',
    authorName: '主理人 Nico',
    avatar:
      'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&q=80',
    minutesAgo: 48,
    zoneTag: 'stage_b',
    ratings: [
      { categoryId: 'water_queue', score: 5 },
      { categoryId: 'toilet_queue', score: 3 },
      { categoryId: 'entry_crowd', score: 4 },
      { categoryId: 'smoke_drink', score: 4 },
    ],
    remark: '散场高峰：接水点排长队，建议去 C 区后方自动售货机，人少一些',
    likedByUserIds: ['demo-mia', 'demo-nico'],
  },
  {
    activityLegacyId: 4,
    userId: 'demo-jade',
    authorName: 'Jade',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80',
    minutesAgo: 55,
    zoneTag: 'stage_a',
    ratings: [
      { categoryId: 'smoke_drink', score: 5 },
      { categoryId: 'sound_level', score: 5 },
    ],
    remark: '场内禁烟但室外吸烟区爆满，买酒要排两圈，想抽烟得去停车场那边',
    likedByUserIds: [],
  },
];
