import type {
  PersonalityQuestion,
  RaverPersonalityType,
} from '../personality-test.types';
import { PERSONALITY_TEST_MEDIA } from './personality-media';
import type { PersonalityQuestionSlot } from './personality-question-slots';

const w = (weights: Partial<Record<RaverPersonalityType, number>>) => weights;

/** Additional questions per slot — merged into pools for random draw. */
export const PERSONALITY_QUESTION_POOLS_EXTRA: Record<
  PersonalityQuestionSlot,
  PersonalityQuestion[]
> = {
  audio_drop: [
    {
      id: 'audio-drop-melodic',
      prompt: '这段旋律 drop 落下时，你更想？',
      media: {
        type: 'audio',
        assetKey: PERSONALITY_TEST_MEDIA.AUDIO_BIG_ROOM_DROP,
        caption: 'Melodic drop',
      },
      options: [
        {
          id: 'audio-drop-melodic-a',
          label: '举手合唱，情绪拉满',
          weights: w({ rager: 2, vibe_curator: 1 }),
        },
        {
          id: 'audio-drop-melodic-b',
          label: '分辨 lead 与 pad 的层次',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'audio-drop-melodic-c',
          label: '轻轻 sway，不抢前排',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'audio-drop-melodic-d',
          label: '录一段情绪高光',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'audio-drop-double',
      prompt: '连续两次 drop 连着砸，你会？',
      media: {
        type: 'audio',
        assetKey: PERSONALITY_TEST_MEDIA.AUDIO_BIG_ROOM_DROP,
        caption: 'Double drop',
      },
      options: [
        {
          id: 'audio-drop-double-a',
          label: '第二遍跳得更狠',
          weights: w({ rager: 3 }),
        },
        {
          id: 'audio-drop-double-b',
          label: '对比两次编曲差异',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'audio-drop-double-c',
          label: '有点累，退到侧面喘口气',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'audio-drop-double-d',
          label: '剪成前后对比短视频',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'audio-drop-surprise',
      prompt: '以为要进 drop 却突然静音，你会？',
      media: {
        type: 'audio',
        assetKey: PERSONALITY_TEST_MEDIA.AUDIO_BIG_ROOM_DROP,
        caption: 'Fake drop',
      },
      options: [
        {
          id: 'audio-drop-surprise-a',
          label: '焦躁，等真正的爆发',
          weights: w({ rager: 3 }),
        },
        {
          id: 'audio-drop-surprise-b',
          label: '欣赏这个 tension 设计',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'audio-drop-surprise-c',
          label: '享受安静那几秒',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'audio-drop-surprise-d',
          label: '抓拍全场举手那一刻',
          weights: w({ documentarian: 2, vibe_curator: 1 }),
        },
      ],
    },
  ],
  track_reaction: [
    {
      id: 'track-id-request',
      prompt: '旁边有人疯狂安利一首 ID，你会？',
      options: [
        {
          id: 'track-id-request-a',
          label: '一起猜制作人，越聊越兴奋',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'track-id-request-b',
          label: '先听 drop 爽了再说',
          weights: w({ rager: 3 }),
        },
        {
          id: 'track-id-request-c',
          label: '加好友，以后一起追 set',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'track-id-request-d',
          label: '录片段回去搜同款',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'track-vocal-drop',
      prompt: '突然插入熟悉的人声采样，你？',
      options: [
        {
          id: 'track-vocal-drop-a',
          label: '立刻跟唱，气氛组上线',
          weights: w({ rager: 2, vibe_curator: 1 }),
        },
        {
          id: 'track-vocal-drop-b',
          label: '想弄清采样出处',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'track-vocal-drop-c',
          label: '微笑点头，继续晃',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'track-vocal-drop-d',
          label: '录下合唱画面',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'track-tempo-shift',
      prompt: 'BPM 突然加快一整档，你会？',
      options: [
        {
          id: 'track-tempo-shift-a',
          label: '跟上节奏，越蹦越快',
          weights: w({ rager: 3 }),
        },
        {
          id: 'track-tempo-shift-b',
          label: '留意 DJ 怎么过渡的',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'track-tempo-shift-c',
          label: '有点跟不上，先旁观',
          weights: w({ zen_raver: 3 }),
        },
        {
          id: 'track-tempo-shift-d',
          label: '拍朋友反应做 vlog',
          weights: w({ documentarian: 2, vibe_curator: 1 }),
        },
      ],
    },
  ],
  stage_visual: [
    {
      id: 'stage-crowd-view',
      prompt: '你更喜欢从哪个角度看舞台？',
      options: [
        {
          id: 'stage-crowd-view-a',
          label: '前排正中，被 bass 糊脸',
          weights: w({ rager: 3 }),
        },
        {
          id: 'stage-crowd-view-b',
          label: '侧面看台，看整体编排',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'stage-crowd-view-c',
          label: '后排高处，看人群波浪',
          weights: w({ vibe_curator: 2, zen_raver: 1 }),
        },
        {
          id: 'stage-crowd-view-d',
          label: '找机位拍全景',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'stage-special-effect',
      prompt: '现场突然喷火/放冷焰，你？',
      options: [
        {
          id: 'stage-special-effect-a',
          label: '尖叫，能量再上一层',
          weights: w({ rager: 3 }),
        },
        {
          id: 'stage-special-effect-b',
          label: '觉得略浮夸，更关注音乐',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'stage-special-effect-c',
          label: '拉着搭子一起欢呼',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'stage-special-effect-d',
          label: '举手机拍特效',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'stage-minimal',
      prompt: '如果遇到极简视觉（几乎只有灯光）的 set，你？',
      options: [
        {
          id: 'stage-minimal-a',
          label: '有点无聊，想换舞台',
          weights: w({ rager: 3 }),
        },
        {
          id: 'stage-minimal-b',
          label: '正合我意，专心听音乐',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'stage-minimal-c',
          label: '反而更容易进入聊天状态',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'stage-minimal-d',
          label: '适合拍剪影氛围片',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
  ],
  set_priority: [
    {
      id: 'set-priority-headliner',
      prompt: '压轴大牌和冷门宝藏撞车，你选？',
      options: [
        {
          id: 'set-priority-headliner-a',
          label: '冷门那位，审美优先',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'set-priority-headliner-b',
          label: '压轴，集体狂欢不能错过',
          weights: w({ rager: 3 }),
        },
        {
          id: 'set-priority-headliner-c',
          label: '看搭子想去哪',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'set-priority-headliner-d',
          label: '哪边更好拍去哪边',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'set-priority-b2b',
      prompt: 'B2B set 和 solo set 只能二选一，你？',
      options: [
        {
          id: 'set-priority-b2b-a',
          label: 'B2B，看两人怎么对话',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'set-priority-b2b-b',
          label: 'solo，能量更集中',
          weights: w({ rager: 3 }),
        },
        {
          id: 'set-priority-b2b-c',
          label: '哪边朋友多去哪边',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'set-priority-b2b-d',
          label: '选更容易出片的那位',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'set-priority-discovery',
      prompt: '行程表上有个完全不认识的 DJ，你会？',
      options: [
        {
          id: 'set-priority-discovery-a',
          label: '先查 set 风格再决定',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'set-priority-discovery-b',
          label: '路过听到爽就直接停下',
          weights: w({ rager: 3 }),
        },
        {
          id: 'set-priority-discovery-c',
          label: '有人推荐就去看看',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'set-priority-discovery-d',
          label: '随缘，走到哪听到哪',
          weights: w({ zen_raver: 3 }),
        },
      ],
    },
  ],
  buddy_plan: [
    {
      id: 'buddy-plan-split',
      prompt: '队伍里有人想冲 A 舞台、有人想冲 B，你？',
      options: [
        {
          id: 'buddy-plan-split-a',
          label: '提议分头各看一半再汇合',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'buddy-plan-split-b',
          label: '选更炸的那边，拉所有人一起',
          weights: w({ rager: 3 }),
        },
        {
          id: 'buddy-plan-split-c',
          label: '折中找中间舞台一起逛',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'buddy-plan-split-d',
          label: '自己按清单走，晚点再聊',
          weights: w({ documentarian: 2, connoisseur: 1 }),
        },
      ],
    },
    {
      id: 'buddy-plan-tired',
      prompt: '搭子说累了想回营地，但你正嗨，你？',
      options: [
        {
          id: 'buddy-plan-tired-a',
          label: '陪回去，明天再战',
          weights: w({ vibe_curator: 2, zen_raver: 1 }),
        },
        {
          id: 'buddy-plan-tired-b',
          label: '留下继续冲，约晚点汇合',
          weights: w({ rager: 3 }),
        },
        {
          id: 'buddy-plan-tired-c',
          label: '换个小厅一起安静听会儿',
          weights: w({ zen_raver: 2, connoisseur: 1 }),
        },
        {
          id: 'buddy-plan-tired-d',
          label: '先送一段再回来拍素材',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'buddy-plan-meetup',
      prompt: '约好的汇合时间到了，你还在看 set，你？',
      options: [
        {
          id: 'buddy-plan-meetup-a',
          label: '听完当前这首再去',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'buddy-plan-meetup-b',
          label: '发消息说晚十分钟',
          weights: w({ rager: 2, vibe_curator: 1 }),
        },
        {
          id: 'buddy-plan-meetup-c',
          label: '立刻过去，不让朋友等',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'buddy-plan-meetup-d',
          label: '拍个现场定位发过去',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
  ],
  festival_peak: [
    {
      id: 'peak-sunrise',
      prompt: '日出 set 对你意味着什么？',
      options: [
        {
          id: 'peak-sunrise-a',
          label: '最后一波能量释放',
          weights: w({ rager: 3 }),
        },
        {
          id: 'peak-sunrise-b',
          label: '一天里最诗意的收尾',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'peak-sunrise-c',
          label: '和熟人拥抱告别的时刻',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'peak-sunrise-d',
          label: '必拍的 golden hour 素材',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'peak-rain',
      prompt: '突然下雨但 DJ 没停，你？',
      options: [
        {
          id: 'peak-rain-a',
          label: '淋着雨蹦得更疯',
          weights: w({ rager: 3 }),
        },
        {
          id: 'peak-rain-b',
          label: '躲雨但竖着耳朵听',
          weights: w({ connoisseur: 2, zen_raver: 1 }),
        },
        {
          id: 'peak-rain-c',
          label: '和周围人笑着躲一块',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'peak-rain-d',
          label: '拍雨里蹦迪的电影感画面',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'peak-surprise-guest',
      prompt: '阵容外惊喜嘉宾突然上台，你？',
      options: [
        {
          id: 'peak-surprise-guest-a',
          label: '尖叫，冲到更前面',
          weights: w({ rager: 3 }),
        },
        {
          id: 'peak-surprise-guest-b',
          label: '好奇他会放什么风格',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'peak-surprise-guest-c',
          label: '立刻发消息喊朋友过来',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'peak-surprise-guest-d',
          label: '全程录下 reaction',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
  ],
  afterhours: [
    {
      id: 'after-warehouse',
      prompt: '如果有地下仓库 after，你？',
      options: [
        {
          id: 'after-warehouse-a',
          label: '必须去，通宵也值',
          weights: w({ rager: 2, connoisseur: 1 }),
        },
        {
          id: 'after-warehouse-b',
          label: '挑更偏审美的那场',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'after-warehouse-c',
          label: '跟大部队走就行',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'after-warehouse-d',
          label: '太累，回酒店剪片',
          weights: w({ documentarian: 2, zen_raver: 1 }),
        },
      ],
    },
    {
      id: 'after-food',
      prompt: '凌晨饿了出来觅食，你更像？',
      options: [
        {
          id: 'after-food-a',
          label: '吃完立刻杀回舞池',
          weights: w({ rager: 3 }),
        },
        {
          id: 'after-food-b',
          label: '边吃边复盘今晚 set',
          weights: w({ connoisseur: 2, vibe_curator: 1 }),
        },
        {
          id: 'after-food-c',
          label: '宵夜局才是第二现场',
          weights: w({ vibe_curator: 3 }),
        },
        {
          id: 'after-food-d',
          label: '顺便整理素材再睡',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
    {
      id: 'after-silent',
      prompt: '主活动结束后的安静时刻，你更需要？',
      options: [
        {
          id: 'after-silent-a',
          label: '再来点音乐，别停',
          weights: w({ rager: 3 }),
        },
        {
          id: 'after-silent-b',
          label: '耳机里放今天最爱的 ID',
          weights: w({ connoisseur: 3 }),
        },
        {
          id: 'after-silent-c',
          label: '和朋友躺着聊天',
          weights: w({ vibe_curator: 2, zen_raver: 1 }),
        },
        {
          id: 'after-silent-d',
          label: '独处剪视频',
          weights: w({ documentarian: 3 }),
        },
      ],
    },
  ],
  memory_finale: [
    {
      id: 'memory-one-photo',
      prompt: '如果只能留一张照片，你会拍？',
      weightMultiplier: 1.5,
      options: [
        {
          id: 'memory-one-photo-a',
          label: '万人 jump 的瞬间',
          weights: w({ rager: 4 }),
        },
        {
          id: 'memory-one-photo-b',
          label: '冷门舞台的 DJ 特写',
          weights: w({ connoisseur: 4 }),
        },
        {
          id: 'memory-one-photo-c',
          label: '和搭子的合影',
          weights: w({ vibe_curator: 4 }),
        },
        {
          id: 'memory-one-photo-d',
          label: '日出与舞台剪影',
          weights: w({ zen_raver: 3, documentarian: 1 }),
        },
        {
          id: 'memory-one-photo-e',
          label: '自己入镜的 vlog 封面',
          weights: w({ documentarian: 4 }),
        },
      ],
    },
    {
      id: 'memory-tell-friends',
      prompt: '回家朋友问你这场怎么样，你先讲？',
      weightMultiplier: 1.5,
      options: [
        {
          id: 'memory-tell-friends-a',
          label: '最炸的那个 drop',
          weights: w({ rager: 4 }),
        },
        {
          id: 'memory-tell-friends-b',
          label: '一段冷门神 set',
          weights: w({ connoisseur: 4 }),
        },
        {
          id: 'memory-tell-friends-c',
          label: '认识的人和趣事',
          weights: w({ vibe_curator: 4 }),
        },
        {
          id: 'memory-tell-friends-d',
          label: '安静听完的那首歌',
          weights: w({ zen_raver: 4 }),
        },
        {
          id: 'memory-tell-friends-e',
          label: '播放量最高的那条视频',
          weights: w({ documentarian: 4 }),
        },
      ],
    },
    {
      id: 'memory-core-feeling',
      prompt: '用一句话形容你理想的音乐节体验？',
      weightMultiplier: 1.5,
      options: [
        {
          id: 'memory-core-feeling-a',
          label: '全身汗水、跳到腿软',
          weights: w({ rager: 4 }),
        },
        {
          id: 'memory-core-feeling-b',
          label: '听到改变审美的 set',
          weights: w({ connoisseur: 4 }),
        },
        {
          id: 'memory-core-feeling-c',
          label: '和对的人在对的时间',
          weights: w({ vibe_curator: 4 }),
        },
        {
          id: 'memory-core-feeling-d',
          label: '不赶行程、心很静',
          weights: w({ zen_raver: 4 }),
        },
        {
          id: 'memory-core-feeling-e',
          label: '留下能反复看的记录',
          weights: w({ documentarian: 4 }),
        },
      ],
    },
  ],
};
