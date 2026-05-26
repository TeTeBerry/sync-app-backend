import { Document } from '@langchain/core/documents';

/** 音乐节 FAQ，供 RAG 入库 */
export const KNOWLEDGE_DOCUMENTS: Document[] = [
  new Document({
    pageContent:
      'EDC China 电音节（edc）2025 年演出档期：2025-07-12 至 2025-07-13，地点苏州阳澄湖。别名：edc、edc中国、edc电音。',
    metadata: { topic: 'activity', code: 'edc' },
  }),
  new Document({
    pageContent:
      'Ultra 成都（ultra）2025 年演出档期：2025-08-01 至 2025-08-03，地点成都。别名：ultra、ultra chengdu、ultra 成都、ultra china。',
    metadata: { topic: 'activity', code: 'ultra' },
  }),
  new Document({
    pageContent:
      'Ultra Europe 欧洲站（ultra-europe）通常在克罗地亚斯普利特举办，与国内 Ultra 成都 区分。别名：ultra europe、欧洲ultra。',
    metadata: { topic: 'activity', code: 'ultra-europe' },
  }),
  new Document({
    pageContent:
      'EDC Thailand（edc-thailand）2025 年演出档期：2025-12-08，地点泰国。别名：edc thailand、edc泰国、泰国edc。与国内 EDC China 区分。',
    metadata: { topic: 'activity', code: 'edc-thailand' },
  }),
  new Document({
    pageContent:
      'Tomorrowland 预热派对（tomorrowland）2025 年档期：2025-06-18 至 2025-06-19，地点上海 CLUB SPACE。别名：tomorrowland、tmw、明日世界。',
    metadata: { topic: 'activity', code: 'tomorrowland' },
  }),
  new Document({
    pageContent:
      'VAC 珠海电音节（vac-zhuhai，Vision & Colour / Heineken Soundscape）2025 年档期：2025-04-18 至 2025-04-19，地点珠海。别名：vac、vision & colour、珠海vac。',
    metadata: { topic: 'activity', code: 'vac-zhuhai' },
  }),
  new Document({
    pageContent:
      '风暴电音节（storm，口味王风暴）是国内大型电音节品牌，常见城市站包括深圳、上海等。别名：风暴、storm、口味王风暴、风暴电音节。',
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
    pageContent:
      'Untold Festival 是罗马尼亚大型电音节。别名：untold。',
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
