import type {
  PersonalityQuestion,
  RaverPersonalityType,
} from '../personality-test.types';
import { PERSONALITY_TEST_MEDIA } from './personality-media';
import type { PersonalityQuestionSlot } from './personality-question-slots';
import { PERSONALITY_QUESTION_SLOTS } from './personality-question-slots';
import { PERSONALITY_QUESTION_POOLS_EXTRA } from './personality-question-pools-extra';

const w = (weights: Partial<Record<RaverPersonalityType, number>>) => weights;

const BASE_PERSONALITY_QUESTION_POOLS: Record<
  PersonalityQuestionSlot,
  PersonalityQuestion[]
> = {
  audio_drop: [
    {
      id: 'audio-drop-bigroom',
      prompt: '听到这段 drop，你的第一反应是？',
      media: {
        type: 'audio',
        assetKey: PERSONALITY_TEST_MEDIA.AUDIO_BIG_ROOM_DROP,
        caption: 'Big Room drop',
      },
      options: [
        {
          id: 'audio-drop-bigroom-a',
          label: '立刻甩头，能量拉满',
          weights: w({ rager: 3 }),
        },
        {
          id: 'audio-drop-bigroom-b',
          label: '冷静分析这个 kick 的层次',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'audio-drop-bigroom-c',
          label: '想退到后排，太吵了',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'audio-drop-bigroom-d',
          label: '打开手机录视频',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'audio-drop-bass',
      prompt: '这段 bass drop 砸下来时，你会？',
      media: {
        type: 'audio',
        assetKey: PERSONALITY_TEST_MEDIA.AUDIO_BIG_ROOM_DROP,
        caption: 'Bass drop',
      },
      options: [
        {
          id: 'audio-drop-bass-a',
          label: '胸腔共振，立刻冲进前排',
          weights: w({ rager: 3 }),
        },
        {
          id: 'audio-drop-bass-b',
          label: '先听 sub 和失真怎么处理',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'audio-drop-bass-c',
          label: '太猛了，先往后退两步',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'audio-drop-bass-d',
          label: '举机记录这一刻的低频',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'audio-drop-build',
      prompt: '长 build-up 后终于进 drop，你通常？',
      media: {
        type: 'audio',
        assetKey: PERSONALITY_TEST_MEDIA.AUDIO_BIG_ROOM_DROP,
        caption: 'Build-up → drop',
      },
      options: [
        {
          id: 'audio-drop-build-a',
          label: '早就准备好起跳',
          weights: w({ rager: 3 }),
        },
        {
          id: 'audio-drop-build-b',
          label: '回味刚才的 tension 设计',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'audio-drop-build-c',
          label: '闭眼等情绪落地',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'audio-drop-build-d',
          label: '掐点按下录制键',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
  ],
  track_reaction: [
    {
      id: 'track-unknown',
      prompt: '听到一首没听过的 track，你的第一反应？',
      options: [
        {
          id: 'track-unknown-a',
          label: '立刻 Shazam，查制作人 discography',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'track-unknown-b',
          label: 'Drop 一来直接起跳，管它叫什么',
          weights: w({ rager: 3 }),
        },
        {
          id: 'track-unknown-c',
          label: '先录 15 秒发 Stories',
          weights: w({ documentarian: 3 }),
        },
        {
          id: 'track-unknown-d',
          label: '闭眼感受，不急着知道歌名',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
    {
      id: 'track-set-open',
      prompt: 'Set 开场前三分钟，你更可能？',
      options: [
        {
          id: 'track-set-open-a',
          label: '耐心听铺垫，判断 set 走向',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'track-set-open-b',
          label: '嫌慢，等第一个高能段落',
          weights: w({ rager: 3 }),
        },
        {
          id: 'track-set-open-c',
          label: '边聊边听，感受现场氛围',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'track-set-open-d',
          label: '先找角度拍舞台空镜',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'track-genre-switch',
      prompt: 'DJ 突然切到完全陌生的小众曲风，你会？',
      options: [
        {
          id: 'track-genre-switch-a',
          label: '兴奋，认真听这段审美',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'track-genre-switch-b',
          label: '等熟悉的 drop 回来',
          weights: w({ rager: 3 }),
        },
        {
          id: 'track-genre-switch-c',
          label: '无所谓，跟着周围人动',
          weights: w({ vibe_curator: 2, zen_raver: 1 }),
        },
        {
          id: 'track-genre-switch-d',
          label: '有点懵，先退到侧面',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
  ],
  stage_visual: [
    {
      id: 'stage-visual-style',
      prompt: '你更喜欢哪种舞台视觉？',
      options: [
        {
          id: 'stage-visual-style-a',
          label: '激光射线+爆闪（刺激）',
          weights: w({ rager: 3 }),
        },
        {
          id: 'stage-visual-style-b',
          label: '粒子流动+渐变（沉浸）',
          weights: w({ zen_raver: 2, vibe_curator: 1 }),
        },
        {
          id: 'stage-visual-style-c',
          label: '几何矩阵+节奏同步（理性）',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'stage-visual-style-d',
          label: '霓虹文字+复古（怀旧）',
          weights: w({ vibe_curator: 2, documentarian: 1 }),
        },
      ],
    },
    {
      id: 'stage-lighting',
      prompt: '哪种舞台灯光更打动你？',
      options: [
        {
          id: 'stage-lighting-a',
          label: '频闪+激光扫射',
          weights: w({ rager: 3 }),
        },
        {
          id: 'stage-lighting-b',
          label: '柔和染色+雾面光晕',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'stage-lighting-c',
          label: '节拍同步的几何图案',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'stage-lighting-d',
          label: '大面积 LED 字幕与复古排版',
          weights: w({ vibe_curator: 2, documentarian: 1 }),
        },
      ],
    },
    {
      id: 'stage-design',
      prompt: '你更会被哪种舞美吸引？',
      options: [
        {
          id: 'stage-design-a',
          label: '火焰/特效+强对比',
          weights: w({ rager: 3 }),
        },
        {
          id: 'stage-design-b',
          label: '流动视觉+沉浸空间',
          weights: w({ zen_raver: 2, vibe_curator: 1 }),
        },
        {
          id: 'stage-design-c',
          label: '结构感强的视觉叙事',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'stage-design-d',
          label: '适合合影的霓虹装置',
          weights: w({ vibe_curator: 3 }),
        },
      ],
    },
  ],
  set_priority: [
    {
      id: 'set-priority-main',
      prompt: '你选 set 的第一优先级是？',
      options: [
        {
          id: 'set-priority-main-a',
          label: '制作人风格和曲目编排',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'set-priority-main-b',
          label: 'BPM 和 bass 够不够狠',
          weights: w({ rager: 3 }),
        },
        {
          id: 'set-priority-main-c',
          label: '这个舞台拍照出不出片',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'set-priority-main-d',
          label: '能不能完整录下整场 set',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'set-priority-conflict',
      prompt: '两个心仪 set 时间撞车，你优先？',
      options: [
        {
          id: 'set-priority-conflict-a',
          label: '审美更独特、更实验的那位',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'set-priority-conflict-b',
          label: '现场能量更炸的那位',
          weights: w({ rager: 3 }),
        },
        {
          id: 'set-priority-conflict-c',
          label: '搭子都在那边的那位',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'set-priority-conflict-d',
          label: '更容易录到高光片段的那位',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'set-priority-late',
      prompt: '凌晨 3 点还在纠结去哪个舞台，你更看重？',
      options: [
        {
          id: 'set-priority-late-a',
          label: '音乐性，想安静听完一段',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'set-priority-late-b',
          label: '还能不能蹦起来',
          weights: w({ rager: 3 }),
        },
        {
          id: 'set-priority-late-c',
          label: '现场还剩多少熟面孔',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'set-priority-late-d',
          label: '灯光效果是否适合收尾素材',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
  ],
  buddy_plan: [
    {
      id: 'buddy-plan-change',
      prompt: '搭子临时改计划，你会？',
      options: [
        {
          id: 'buddy-plan-change-a',
          label: '无所谓，跟着走，现场氛围最重要',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'buddy-plan-change-b',
          label: '坚持自己要的 set，各看各的再汇合',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'buddy-plan-change-c',
          label: '重新规划路线，确保不错过 top 3',
          weights: w({ rager: 2, connoisseur: 1 }),
        },
        {
          id: 'buddy-plan-change-d',
          label: '顺势调整，反正享受过程',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
    {
      id: 'buddy-plan-lost',
      prompt: '现场和搭子走散，你第一反应？',
      options: [
        {
          id: 'buddy-plan-lost-a',
          label: '继续看 set，晚点再联系',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'buddy-plan-lost-b',
          label: '马上冲去最热闹的舞台找人',
          weights: w({ rager: 2, vibe_curator: 1 }),
        },
        {
          id: 'buddy-plan-lost-c',
          label: '发定位约汇合点，先社交',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'buddy-plan-lost-d',
          label: '先拍段现场发群聊报平安',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'buddy-plan-new',
      prompt: '陌生 Raver 邀请你一起转场，你会？',
      options: [
        {
          id: 'buddy-plan-new-a',
          label: '看对方品味再决定',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'buddy-plan-new-b',
          label: '说走就走，热闹最重要',
          weights: w({ rager: 2, vibe_curator: 1 }),
        },
        {
          id: 'buddy-plan-new-c',
          label: '很乐意，多一个搭子更好',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'buddy-plan-new-d',
          label: '婉拒，想按自己节奏逛',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
  ],
  festival_peak: [
    {
      id: 'peak-main-hour',
      prompt: '音乐节里你最容易进状态的时刻是？',
      options: [
        {
          id: 'peak-main-hour-a',
          label: '黄金时段主舞台，全场一起跳',
          weights: w({ rager: 3 }),
        },
        {
          id: 'peak-main-hour-b',
          label: '冷门舞台突然对上审美',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'peak-main-hour-c',
          label: '和搭子在人群中汇合那刻',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'peak-main-hour-d',
          label: '日出前安静听完最后一首',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
    {
      id: 'peak-day-moment',
      prompt: '一天里你最期待的环节是？',
      options: [
        {
          id: 'peak-day-moment-a',
          label: '傍晚开场，能量开始爬升',
          weights: w({ rager: 2, vibe_curator: 1 }),
        },
        {
          id: 'peak-day-moment-b',
          label: '换舞台时挖到惊喜 set',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'peak-day-moment-c',
          label: '朋友都在的社交高峰',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'peak-day-moment-d',
          label: '灯光最出片的那段时间',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'peak-immersion',
      prompt: '什么时候你会完全沉浸、忘记看时间？',
      options: [
        {
          id: 'peak-immersion-a',
          label: 'BPM 拉满、前排蹦到腿软',
          weights: w({ rager: 3 }),
        },
        {
          id: 'peak-immersion-b',
          label: '听到完整叙事的长 set',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'peak-immersion-c',
          label: '氛围刚好、身边都是同频的人',
          weights: w({ vibe_curator: 2, zen_raver: 1 }),
        },
        {
          id: 'peak-immersion-d',
          label: '找到一个舒服角落慢慢听',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
  ],
  afterhours: [
    {
      id: 'after-main-stage',
      prompt: '主舞台结束后，你更倾向于？',
      options: [
        {
          id: 'after-main-stage-a',
          label: '转场 afterparty，继续冲',
          weights: w({ rager: 3 }),
        },
        {
          id: 'after-main-stage-b',
          label: '找小厅听更深层的 set',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'after-main-stage-c',
          label: '和搭子复盘今晚高光',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'after-main-stage-d',
          label: '回酒店剪视频、发内容',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'after-energy',
      prompt: '凌晨之后你的电量通常？',
      options: [
        {
          id: 'after-energy-a',
          label: '还很高，越晚越兴奋',
          weights: w({ rager: 3 }),
        },
        {
          id: 'after-energy-b',
          label: '挑一个最想听完的收尾',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'after-energy-c',
          label: '更想聊天和社交',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'after-energy-d',
          label: '需要安静缓一缓',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
    {
      id: 'after-next-day',
      prompt: '音乐节第二天你的状态更像？',
      options: [
        {
          id: 'after-next-day-a',
          label: '照样冲前排，不怕累',
          weights: w({ rager: 3 }),
        },
        {
          id: 'after-next-day-b',
          label: '精选几个 set，不盲目赶场',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'after-next-day-c',
          label: '跟着队伍节奏走',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'after-next-day-d',
          label: '整理素材、补觉、慢慢恢复',
          weights: w({ documentarian: 2, zen_raver: 1 }),
        },
      ],
    },
  ],
  memory_finale: [
    {
      id: 'memory-keep-one',
      prompt: '如果只能带走一样回忆，你选？',
      weightMultiplier: 1.5,
      options: [
        {
          id: 'memory-keep-one-a',
          label: '和 thousands 人一起 jump 的瞬间',
          weights: w({ rager: 4 }),
        },
        {
          id: 'memory-keep-one-b',
          label: '在冷门舞台发现本命艺人的那一刻',
          weights: w({ connoisseur: 4 }),
        },
        {
          id: 'memory-keep-one-c',
          label: '和陌生 Raver 成为搭子的故事',
          weights: w({ vibe_curator: 4 }),
        },
        {
          id: 'memory-keep-one-d',
          label: '日出时安静听完最后一首的感动',
          weights: w({ zen_raver: 4 }),
        },
        {
          id: 'memory-keep-one-e',
          label: '被转发的爆款现场 clip',
          weights: w({ documentarian: 4 }),
        },
      ],
    },
    {
      id: 'memory-festival',
      prompt: '这场音乐节结束后，你最想记住的是？',
      weightMultiplier: 1.5,
      options: [
        {
          id: 'memory-festival-a',
          label: '最炸的那个 drop 和全场尖叫',
          weights: w({ rager: 4 }),
        },
        {
          id: 'memory-festival-b',
          label: '一段冷门但完美的 set',
          weights: w({ connoisseur: 4 }),
        },
        {
          id: 'memory-festival-c',
          label: '认识的人和新发生的连接',
          weights: w({ vibe_curator: 4 }),
        },
        {
          id: 'memory-festival-d',
          label: '不赶行程、慢慢逛的夜晚',
          weights: w({ zen_raver: 4 }),
        },
        {
          id: 'memory-festival-e',
          label: '手机里最满意的一条视频',
          weights: w({ documentarian: 4 }),
        },
      ],
    },
    {
      id: 'memory-return',
      prompt: '如果明年只能再回来一次，你为的是？',
      weightMultiplier: 1.5,
      options: [
        {
          id: 'memory-return-a',
          label: '再次体验那种集体释放',
          weights: w({ rager: 4 }),
        },
        {
          id: 'memory-return-b',
          label: '追新的阵容与审美惊喜',
          weights: w({ connoisseur: 4 }),
        },
        {
          id: 'memory-return-c',
          label: '和同一群人再聚一次',
          weights: w({ vibe_curator: 4 }),
        },
        {
          id: 'memory-return-d',
          label: '找回那种不赶时间的平静',
          weights: w({ zen_raver: 4 }),
        },
        {
          id: 'memory-return-e',
          label: '拍出比今年更好的素材',
          weights: w({ documentarian: 4 }),
        },
      ],
    },
  ],
};

export const PERSONALITY_QUESTION_POOLS: Record<
  PersonalityQuestionSlot,
  PersonalityQuestion[]
> = Object.fromEntries(
  PERSONALITY_QUESTION_SLOTS.map((slot) => [
    slot,
    [
      ...BASE_PERSONALITY_QUESTION_POOLS[slot],
      ...PERSONALITY_QUESTION_POOLS_EXTRA[slot],
    ],
  ]),
) as Record<PersonalityQuestionSlot, PersonalityQuestion[]>;

export const ALL_PERSONALITY_POOL_QUESTIONS: PersonalityQuestion[] =
  Object.values(PERSONALITY_QUESTION_POOLS).flat();
