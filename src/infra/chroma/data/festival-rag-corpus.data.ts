/**
 * Curated RAG corpus per catalog activity code.
 * Topics map to Chroma metadata.topic on build (story | lineup_hint | survival | activity).
 * @see src/infra/chroma/README.md
 */
export type FestivalRagCorpusEntry = {
  code: string;
  /** Q2-41 · 节故事 / 品牌背景 */
  story?: string;
  /** Q2-47 · 阵容官宣规律（不承诺今年） */
  lineupAnnounceHint?: string;
  /** Q2-48 · 节别生存/出行一句 */
  survivalHint?: string;
  /** 易混节区分说明 */
  disambiguation?: string;
  /** 活动 FAQ 补充（catalog 同步不含阵容细节时） */
  activityFaq?: string;
};

export const FESTIVAL_RAG_CORPUS: FestivalRagCorpusEntry[] = [
  {
    code: 'storm',
    story:
      'STORM 风暴电音节是国内大型户外电音节品牌，深圳站为年度旗舰场，多舞台 + 国内主流与国际化 headliner 混合。',
    lineupAnnounceHint:
      '往年深圳站阵容多在 4～5 月陆续公布；官宣前可先浏览该场公开招募帖。',
    survivalHint:
      '国内场：身份证 + 防晒防暑；深圳 6 月湿热，建议轻便透气穿搭与补水。',
    activityFaq:
      'STORM 深圳 2026 档期 6 月 13–14 日，深圳国际会展中心 17 号馆。别名：风暴、storm、百威风暴、口味王风暴。',
  },
  {
    code: 'edc-korea',
    story:
      'EDC Korea 为 Insomniac EDC 品牌韩国站，仁川举办，舞台视觉与美式 carnival 氛围。',
    lineupAnnounceHint:
      '往年韩国站阵容约提前 2～3 个月公布；可关注 EDC Korea 官网与 Melon Ticket。',
    survivalHint:
      '韩国入境请提前确认签证/K-ETA；仁川会场建议预留 Shuttle 或地铁+打车方案。',
    disambiguation:
      '与 EDC Thailand、EDC Orlando、国内 EDC China 不同场，购票与签证目的地按韩国准备。',
    activityFaq:
      'EDC Korea 2026 仁川 Inspire Entertainment Resort，10 月 3–4 日。别名：edc korea、韩国edc、仁川edc。',
  },
  {
    code: 'edc-thailand',
    story:
      'EDC Thailand 为普吉岛海岛 EDC，夜场 + 海滩度假组合，适合东南亚出行。',
    lineupAnnounceHint:
      '往年泰国站阵容与时间表多在夏秋季公布；早鸟票常先于全阵容释出。',
    survivalHint:
      '泰国免签/落地签以入境当日政策为准；备泰铢现金、防晒与防蚊用品。',
    disambiguation: '与 EDC Korea、EDC Orlando 区分；地点普吉岛 Rhythm Park。',
    activityFaq:
      'EDC Thailand 2026 12 月 18–20 日普吉岛。别名：edc thailand、edc泰国、泰国edc。',
  },
  {
    code: 'edc-orlando',
    story:
      'EDC Orlando 为美国 Insomniac 旗舰户外场之一，嘉年华游乐设施 + 多舞台是特色。',
    lineupAnnounceHint:
      '奥兰多场通常较早公布全阵容；官方 timetable 可能临近开场才完整发布。',
    survivalHint:
      '美国入境按护照办理签证/ESTA；现场昼夜温差大，备薄外套与舒适步行鞋。',
    disambiguation: '与亚洲 EDC 系列不同国家，签证与机票按美国目的地规划。',
  },
  {
    code: 'tomorrowland',
    story:
      'Tomorrowland Thailand 为比利时 Tomorrowland 品牌泰国站，童话主舞台与全球化 headliner 阵容。',
    lineupAnnounceHint:
      '往年泰国站全阵容多在夏季公布；可先查看活动详情阵容区与公开招募。',
    survivalHint: '芭提雅炎热潮湿；备泰铢、防晒、会场接驳与酒店预订凭证。',
    disambiguation:
      '与 Tomorrowland Belgium 原版、上海体验展（tomorrowland-shanghai）是不同活动。',
  },
  {
    code: 'tomorrowland-belgium',
    story:
      'Tomorrowland Belgium 是全球最具代表性的电音节之一，比利时 Boom 举办，双周末制。',
    lineupAnnounceHint:
      '往年比利时站销售与阵容窗口多在年初至春季；全球票竞争激烈，以官网抽签/登记为准。',
    survivalHint:
      '申根签证 + 欧洲机票；布鲁塞尔/安特卫普往返 Boom 需提前订交通与露营/酒店。',
    disambiguation: '与泰国站、上海体验展不同；为比利时原版户外节。',
  },
  {
    code: 'tomorrowland-shanghai',
    story:
      'The Magic of Tomorrowland 上海为品牌体验展/沉浸式活动，非比利时同款户外音乐节。',
    lineupAnnounceHint:
      '体验展阵容与场次以主办方官宣为准，通常临近活动月公布详情。',
    survivalHint: '国内场身份证即可；室内场馆注意安检与储物规则。',
    disambiguation:
      '非 Tomorrowland Belgium 或泰国户外站；偏沉浸式体验与品牌展示。',
  },
  {
    code: 'ultra-europe',
    story:
      'Ultra Europe 在克罗地亚斯普利特举办，主舞台海滨夜景 + Resistance techno 氛围。',
    lineupAnnounceHint:
      '往年 Ultra Europe 阵容与每日 timetable 多在春季至初夏公布。',
    survivalHint:
      '申根签证；斯普利特夏季炎热，备防晒、涉水鞋与岛屿间交通方案。',
    activityFaq:
      'Ultra Europe 2026 7 月 11–13 日斯普利特 Poljud Stadium。别名：ultra europe、欧洲ultra。',
  },
  {
    code: 'ultra-japan',
    story:
      'Ultra Japan 为 Ultra 品牌东京场，台场海滨区域举办，偏 mainstream + resistance 混合。',
    lineupAnnounceHint:
      '往年日本 Ultra 阵容约提前 2～4 个月公布；关注 ZAIKO / e+ 售票窗口。',
    survivalHint:
      '日本入境 Visit Japan Web（如适用）；Suica 交通卡 + 东京住宿提前预订。',
    activityFaq:
      'Ultra Japan 2026 东京台场区域。别名：ultra japan、东京ultra。',
  },
  {
    code: 'world-dj-festival',
    story:
      'World DJ Festival Japan 东京台场海滨多舞台音乐节，亚洲 summer 重要 bass/house 场之一。',
    lineupAnnounceHint:
      '往年 WDJF 每日 timetable 在 6 月前后完整公布；可先关注 lineup 区更新。',
    survivalHint: '日本签证/入境政策以官方为准；台场区域地铁海芝浦站步行可达。',
    activityFaq:
      'WDJF 2026 7 月 4–5 日东京海の森。别名：wdjf、world dj festival、东京wdjf。',
  },
  {
    code: 'defqon1',
    story:
      'Defqon.1 是 Hardstyle / Hardcore 领域标志性音乐节，荷兰 Walibi Holland 举办。',
    lineupAnnounceHint:
      '往年 Defqon.1 阵容与主题多在年初公布；hardstyle 粉丝关注 Q-dance 官方渠道。',
    survivalHint:
      '申根签证；荷兰夏季气温适中但户外站立时间长，备耳罩与舒适鞋。',
  },
  {
    code: 's2o',
    story:
      'S2O Thailand 是泼水音乐节形式的大型电音节，曼谷举办，水上舞台是标志体验。',
    lineupAnnounceHint:
      '往年 S2O 阵容多在 1～3 月公布；泼水节档期需防水手机袋。',
    survivalHint:
      '泰国免签/落地签以入境政策为准；现场全身会湿，备速干衣物与防水袋。',
  },
  {
    code: 'soundstorm',
    story:
      'MDLBEAST Soundstorm 为沙特利雅得大型电音节，中东地区重要 bass/mainstage 场。',
    lineupAnnounceHint:
      '往年 Soundstorm 阵容多在秋季公布；关注 MDLBEAST 官方售票窗口。',
    survivalHint: '按沙特入境要求准备签证；当地文化与着装规范请提前了解。',
  },
  {
    code: 'untold-romania',
    story:
      'Untold Festival 罗马尼亚克卢日举办，欧洲大型多曲风电音节，夜间主舞台规模大。',
    lineupAnnounceHint: '往年 Untold 阵容多在春夏公布；可搭配欧洲行程规划。',
    survivalHint: '申根签证；罗马尼亚货币与刷卡习惯提前了解。',
  },
  {
    code: 'creamfields',
    story:
      'Creamfields 品牌源于英国，亚洲/南半球多地有分站，曲风覆盖 mainstream 到 underground。',
    lineupAnnounceHint: '各分站官宣节奏不同，以当站官网为准。',
    survivalHint: '按当站国家准备签证与交通；亚洲场注意雨季与防暑。',
  },
  {
    code: 'untold-dubai',
    story: 'Untold Dubai 为 Untold 品牌中东站，大型主舞台与国际化阵容。',
    lineupAnnounceHint: '往年中东站阵容多在活动前 2～3 个月公布。',
    survivalHint: '按阿联酋入境要求办理签证；12 月相对凉爽但仍需注意补水。',
  },
];

/** Global non–activity-specific RAG snippets. */
export const GLOBAL_RAG_SNIPPETS = {
  assistant:
    '平台支持 AI 查询近期活动、了解电音节信息。回答应简洁、可执行，并在需要时引导用户补充日期、人数、出发城市。',
  ecosystemApps:
    '电音节资讯类小程序常见两类：1）综合资讯聚合（如 EDMLink 等，汇总国内外档期、阵容动态）；2）单场活动官方小程序或公众号（购票、阵容公布、现场指南以主办方为准）。SYNC 提供活动库检索与公开组队招募筛选，不卖票。',
  ecosystemTicketing:
    '查电音节购票渠道时，优先认准活动主办方官方小程序、公众号或官网；第三方聚合平台仅供参考档期。境内大型节如 STORM 等通常有独立官宣渠道；境外场请关注当地主办方公开信息。',
  travelEssentials:
    '出境观演常见准备：确认护照有效期、目的地签证或免签政策、当地货币与支付习惯、往返交通与住宿。韩国、日本、泰国、欧洲等目的地要求不同，请以目的地官方入境政策为准。',
  edcDisambiguation:
    'EDC 系列易混：EDC China（国内苏州/过往届）、EDC Korea（仁川）、EDC Thailand（普吉）、EDC Orlando（奥兰多）为不同活动，签证、购票与出行需按具体场次准备。',
  tomorrowlandDisambiguation:
    'Tomorrowland 易混：比利时 Boom 原版（tomorrowland-belgium）、泰国站（tomorrowland）、上海体验展（tomorrowland-shanghai）是不同活动，勿混用签证与购票渠道。',
};
