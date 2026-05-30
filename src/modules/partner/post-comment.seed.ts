/** Demo comments matched to seeded posts by stable body substring. */
export type PostCommentSeedReply = {
  userId: string;
  authorName: string;
  body: string;
  /** Milliseconds before now for createdAt (should be less than parent ageMs). */
  ageMs: number;
};

export type PostCommentSeedComment = {
  userId: string;
  authorName: string;
  body: string;
  /** Milliseconds before now for createdAt. */
  ageMs: number;
  replies?: PostCommentSeedReply[];
};

export type PostCommentSeedEntry = {
  postBodyContains: string;
  activityLegacyId?: number;
  comments: PostCommentSeedComment[];
};

export const POST_COMMENT_SEED: PostCommentSeedEntry[] = [
  {
    postBodyContains: '6月13-14深圳国际会展中心，3缺1',
    activityLegacyId: 4,
    comments: [
      {
        userId: 'demo-iris',
        authorName: 'Iris',
        body: '深圳土著可以带路，14号场一起进场吗？',
        ageMs: 35 * 60_000,
      },
      {
        userId: 'demo-kyle',
        authorName: 'Kyle',
        body: '我这边也有预售票，可以拼一组进场～',
        ageMs: 18 * 60_000,
      },
    ],
  },
  {
    postBodyContains: 'B区看台，3缺1男生',
    activityLegacyId: 4,
    comments: [
      {
        userId: 'demo-mia',
        authorName: 'Mia',
        body: '广州出发 +1，有车位可以拼车到深圳。',
        ageMs: 50 * 60_000,
      },
      {
        userId: 'demo-max',
        authorName: 'Max',
        body: '同天 B 区，可以一起换票进场。',
        ageMs: 8 * 60_000,
      },
    ],
  },
  {
    postBodyContains: '13号A区 内场票已出，上海出发求拼车',
    activityLegacyId: 4,
    comments: [
      {
        userId: 'demo-alex',
        authorName: 'Alex',
        body: '上海虹桥出发，可以一起订高铁，女生优先。',
        ageMs: 40 * 60_000,
      },
      {
        userId: 'demo-sam',
        authorName: 'Sam',
        body: '我 12 号晚到深圳，可以拼一晚酒店。',
        ageMs: 12 * 60_000,
      },
    ],
  },
  {
    postBodyContains: '13号 A区 有没有人一起进场',
    activityLegacyId: 4,
    comments: [
      {
        userId: 'demo-ryan',
        authorName: 'Ryan',
        body: '同 A 区！可以分享检票口和接驳攻略吗？',
        ageMs: 28 * 60_000,
      },
      {
        userId: 'demo-wendy',
        authorName: 'Wendy',
        body: '第一次来风暴，想组队一起进场～',
        ageMs: 6 * 60_000,
      },
    ],
  },
  {
    postBodyContains: '12月芭提雅场求组队',
    activityLegacyId: 1,
    comments: [
      {
        userId: 'demo-kyle',
        authorName: 'Kyle',
        body: '我也订了 Wisdom Valley 附近，可以拼房。',
        ageMs: 45 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '可以呀，私信我对一下房型～',
            ageMs: 40 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-nova',
        authorName: 'Nova',
        body: '女生一枚，可以一起拼车接机吗？',
        ageMs: 15 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '可以的，我们已有车，稍晚私你～',
            ageMs: 10 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-wendy',
        authorName: 'Wendy',
        body: '酒店大概什么价位？可以一起分摊～',
        ageMs: 8 * 60_000,
      },
    ],
  },
  {
    postBodyContains: 'TML泰国首站！求拼房+接机',
    activityLegacyId: 1,
    comments: [
      {
        userId: 'demo-iris',
        authorName: 'Iris',
        body: '我也订了芭提雅场，可以一起拼接机吗？',
        ageMs: 50 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '可以呀，我们 12 号落地，私我对一下航班～',
            ageMs: 45 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-kyle',
        authorName: 'Kyle',
        body: '还差女生的话我这边有朋友可以一起～',
        ageMs: 25 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '太好了，欢迎拉群聊一下行程～',
            ageMs: 20 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-wendy',
        authorName: 'Wendy',
        body: 'Wisdom Valley 附近有推荐酒店吗？',
        ageMs: 12 * 60_000,
      },
    ],
  },
  {
    postBodyContains: '4月横琴 VAC 已组队',
    activityLegacyId: 6,
    comments: [
      {
        userId: 'demo-nova',
        authorName: 'Nova',
        body: '现场见！想一起逛周边吗？',
        ageMs: 48 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '可以呀，我们一般下午进场前集合～',
            ageMs: 42 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-max',
        authorName: 'Max',
        body: 'VAC 去年去过，可以分享检票和接驳攻略。',
        ageMs: 30 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '感谢！私你我对一下集合点～',
            ageMs: 26 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-kyle',
        authorName: 'Kyle',
        body: '+1 想认识同频搭子，有群吗？',
        ageMs: 10 * 60_000,
      },
    ],
  },
  {
    postBodyContains: '6月深圳 STORM 室内场首进',
    activityLegacyId: 4,
    comments: [
      {
        userId: 'demo-mia',
        authorName: 'Mia',
        body: '还有位置吗？',
        ageMs: 42 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '有的，私我对票区～',
            ageMs: 38 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-max',
        authorName: 'Max',
        body: '价格多少？',
        ageMs: 22 * 60_000,
        replies: [
          {
            userId: 'demo-zara',
            authorName: 'Zara Chen',
            body: '人均大概 800–1200，可以拼～',
            ageMs: 18 * 60_000,
          },
        ],
      },
      {
        userId: 'demo-luna',
        authorName: 'Luna',
        body: '13 号场可以一起进场吗？',
        ageMs: 9 * 60_000,
      },
    ],
  },
];
