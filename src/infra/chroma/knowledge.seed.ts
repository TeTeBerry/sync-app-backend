import { Document } from '@langchain/core/documents';

/** 电音节 FAQ，供 RAG 入库（2026 年公开信息） */
export const KNOWLEDGE_DOCUMENTS: Document[] = [
  new Document({
    pageContent:
      'EDC China 电音节（edc）最近一届为 2025 年 3 月 22 日至 23 日，地点苏州阳澄湖半岛旅游度假区。别名：edc、edc中国、edc电音。2026 档期尚未官宣。',
    metadata: { topic: 'activity', code: 'edc' },
  }),
  new Document({
    pageContent:
      '风暴电音节 STORM 深圳站（storm）2026 年演出档期：2026-06-13 至 2026-06-14，地点深圳国际会展中心 17 号馆。别名：storm、风暴、百威风暴、口味王风暴。',
    metadata: { topic: 'activity', code: 'storm' },
  }),
  new Document({
    pageContent:
      'World DJ Festival Japan 2026（world-dj-festival）2026 年 7 月 4 日至 5 日，地点日本东京海の森水上競技場（台场海滨）。三舞台：World Stage、Dream Stage、Welcome Stage（Powered by SHINDENGEN）；7 月 4–5 日官方时间表已录入，headliner 包括 Porter Robinson、KSHMR、Like Mike、Martin Garrix、Alok、Galantis、Angerfist、Vertile、999999999 等。别名：world dj festival、wdjf、wdjf japan、东京wdjf。',
    metadata: { topic: 'activity', code: 'world-dj-festival' },
  }),
  new Document({
    pageContent:
      'Ultra Europe 2026（ultra-europe）第 11 届，2026 年 7 月 11 日至 13 日，克罗地亚 Poljud Stadium（斯普利特）。四舞台：Ultra Main Stage、Resistance、UMF Radio、Oasis；每日 19:00–05:00。官宣演出时间表已录入，headliner 包括 Armin van Buuren、Tiësto、John Summit、Martin Garrix、Hardwell、Carl Cox、Amelie Lens 等。别名：ultra europe、欧洲ultra。',
    metadata: { topic: 'activity', code: 'ultra-europe' },
  }),
  new Document({
    pageContent:
      'EDC Thailand（edc-thailand）2026 年演出档期：2026-12-18 至 2026-12-20，地点泰国普吉岛 Rhythm Park。别名：edc thailand、edc泰国、泰国edc。与国内 EDC China 区分。',
    metadata: { topic: 'activity', code: 'edc-thailand' },
  }),
  new Document({
    pageContent:
      'EDC Korea（edc-korea）2026 年演出档期：2026-10-03 至 2026-10-04，地点韩国仁川 Inspire Entertainment Resort。别名：edc korea、edc韩国、韩国edc、仁川edc。与 EDC Thailand 区分。',
    metadata: { topic: 'activity', code: 'edc-korea' },
  }),
  new Document({
    pageContent:
      'EDC Orlando 2026（edc-orlando）2026 年 11 月 6 日至 8 日，地点美国奥兰多 Tinker Field。全阵容已官宣（110 位艺人），主要 headliner 包括 Martin Garrix、David Guetta、Hardwell、Steve Aoki、Afrojack、Alan Walker、Alesso、Kaskade、Slander、Meduza、Mau P、Alok 等；官方演出时间表尚未发布。别名：edc orlando、edc奥兰多、orlando edc。',
    metadata: { topic: 'activity', code: 'edc-orlando' },
  }),
  new Document({
    pageContent:
      'Tomorrowland Thailand 2026（tomorrowland）2026 年 12 月 11 日至 13 日，地点泰国芭提雅 Wisdom Valley。全阵容已官宣（116 位艺人），主要 headliner 包括 Swedish House Mafia、Martin Garrix、Dimitri Vegas & Like Mike、Steve Aoki、Afrojack、Alan Walker、Infected Mushroom、Vini Vici、Alok、R3HAB 等；官方演出时间表尚未发布。别名：tomorrowland、tml泰国、明日世界。',
    metadata: { topic: 'activity', code: 'tomorrowland' },
  }),
  new Document({
    pageContent:
      'The Magic Of Tomorrowland 上海 2026（tomorrowland-shanghai）2026 年 10 月 17 日至 18 日，地点上海外滩大会新址科技展馆（黄浦区龙华东路130号，Hero Dome），主题 Planaxis · 海底幻境。别名：tomorrowland shanghai、tml上海、明日世界上海、the magic of tomorrowland。',
    metadata: { topic: 'activity', code: 'tomorrowland-shanghai' },
  }),
  new Document({
    pageContent:
      '2026横琴VAC电音节（vac-zhuhai，喜力星电音呈现）2026 年 4 月 18 日至 19 日，地点横琴长隆度假区 5 号停车场，主题 Neo Zen。别名：vac、vision & colour、横琴vac、珠海vac。',
    metadata: { topic: 'activity', code: 'vac-zhuhai' },
  }),
  new Document({
    pageContent:
      '风暴电音节（storm，口味王风暴/百威风暴）是国内大型电音节品牌，2026 深圳站已官宣。别名：风暴、storm、风暴电音节。',
    metadata: { topic: 'activity', code: 'storm' },
  }),
  new Document({
    pageContent:
      'ADE Amsterdam Dance Event（ade）是荷兰阿姆斯特丹电子音乐周，通常在 10 月举办。别名：ade、amsterdam dance event。',
    metadata: { topic: 'activity', code: 'ade' },
  }),
  new Document({
    pageContent:
      'Creamfields 是英国及亚洲多地举办的电音节品牌，中国场常见 Creamfields 电音节。别名：creamfields、creamfield。',
    metadata: { topic: 'activity', code: 'creamfields' },
  }),
  new Document({
    pageContent:
      'Mysteryland 是荷兰大型电音节，亦在部分地区举办。别名：mysteryland、mystery land。',
    metadata: { topic: 'activity', code: 'mysteryland' },
  }),
  new Document({
    pageContent: 'Untold Festival 是罗马尼亚大型电音节。别名：untold。',
    metadata: { topic: 'activity', code: 'untold' },
  }),
  new Document({
    pageContent:
      'Electric Zoo（electric-zoo）是美国纽约大型电音节。别名：electric zoo、ezoo。',
    metadata: { topic: 'activity', code: 'electric-zoo' },
  }),
  new Document({
    pageContent:
      'DWP Djakarta Warehouse Project（dwp）是印尼雅加达大型电音节。别名：dwp、djakarta warehouse project。',
    metadata: { topic: 'activity', code: 'dwp' },
  }),
  new Document({
    pageContent:
      '平台支持 AI 查询近期活动、了解电音节信息。回答应简洁、可执行，并在需要时引导用户补充日期、人数、出发城市。',
    metadata: { topic: 'assistant' },
  }),
];
