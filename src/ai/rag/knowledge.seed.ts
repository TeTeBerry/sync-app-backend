import { Document } from '@langchain/core/documents';

/** 音乐节 FAQ，供 RAG 入库（2026 年公开信息） */
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
      'Ultra Europe 欧洲站（ultra-europe）通常在克罗地亚斯普利特举办，与国内风暴/EDC 等品牌区分。别名：ultra europe、欧洲ultra。',
    metadata: { topic: 'activity', code: 'ultra-europe' },
  }),
  new Document({
    pageContent:
      'EDC Thailand（edc-thailand）2026 年演出档期：2026-12-18 至 2026-12-20，地点泰国普吉岛 Rhythm Park。别名：edc thailand、edc泰国、泰国edc。与国内 EDC China 区分。',
    metadata: { topic: 'activity', code: 'edc-thailand' },
  }),
  new Document({
    pageContent:
      'Tomorrowland Thailand 2026（tomorrowland）2026 年 12 月 11 日至 13 日，地点泰国芭提雅 Wisdom Valley。别名：tomorrowland、tml泰国、明日世界。',
    metadata: { topic: 'activity', code: 'tomorrowland' },
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
