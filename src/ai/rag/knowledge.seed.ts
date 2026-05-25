import { Document } from '@langchain/core/documents';

/** 音乐节 / 拼单 / 票务 FAQ，供 RAG 入库 */
export const KNOWLEDGE_DOCUMENTS: Document[] = [
  new Document({
    pageContent:
      'EDC China 电音节（edc）2025 年演出档期：2025-07-12 至 2025-07-13，地点苏州阳澄湖。别名：edc、edc中国、edc电音。常见需求：门票转让、酒店拼房、上海/本地出发交通拼单。',
    metadata: { topic: 'activity', code: 'edc' },
  }),
  new Document({
    pageContent:
      'S2O 三亚泼水音乐节（s2o）2025 年演出档期：2025-06-28 至 2025-06-29，地点三亚海棠湾。别名：s2o、泼水节。热门拼单：三亚海景酒店、浦东/各地飞三亚机票、机场接驳。',
    metadata: { topic: 'activity', code: 's2o' },
  }),
  new Document({
    pageContent:
      'Ultra 上海（ultra）2025 年演出档期：2025-08-01 至 2025-08-03，地点上海世博公园。别名：ultra、ultra shanghai。用户常咨询单日/通票、阵容、场馆交通与周边住宿。',
    metadata: { topic: 'activity', code: 'ultra' },
  }),
  new Document({
    pageContent:
      'Ultra Europe 欧洲站（ultra-europe）通常在克罗地亚斯普利特举办，与国内 Ultra Shanghai 区分。别名：ultra europe、欧洲ultra。',
    metadata: { topic: 'activity', code: 'ultra-europe' },
  }),
  new Document({
    pageContent:
      'EDC Thailand（edc-thailand）2025 年演出档期：2025-12-08，地点泰国。别名：edc thailand、edc泰国、泰国edc。与国内 EDC China 区分，购票与拼单需确认届次。',
    metadata: { topic: 'activity', code: 'edc-thailand' },
  }),
  new Document({
    pageContent:
      'Tomorrowland 预热派对（tomorrowland）2025 年档期：2025-06-18 至 2025-06-19，地点上海 CLUB SPACE。别名：tomorrowland、tmw、明日世界。',
    metadata: { topic: 'activity', code: 'tomorrowland' },
  }),
  new Document({
    pageContent:
      'VAC 珠海电音节（vac-zhuhai，Vision & Colour / Heineken Soundscape）2025 年档期：2025-04-18 至 2025-04-19，地点珠海。别名：vac、vision & colour、珠海vac。常见套餐为珠海希尔顿 3天2晚机酒，套餐价为总价非人均；会场穿梭巴士通常另计（如 50 元/人/日、80 元/人/两日）。',
    metadata: { topic: 'activity', code: 'vac-zhuhai' },
  }),
  new Document({
    pageContent:
      '风暴电音节（storm，口味王风暴）是国内大型电音节品牌，常见城市站包括深圳、上海等，活动名常含「风暴」「口味王风暴电音节」及年份、城市站后缀。别名：风暴、storm、口味王风暴、风暴电音节。',
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
      '出票流程：依次确认活动名称、演出日期、票种、数量、价格、联系方式（微信或手机号）；信息齐全后直接创建出售挂单，勿询问是否发布或同步拼单群。收票流程：确认活动、日期、票种、数量、预算与联系方式后直接创建求购挂单。若活动不在平台库中，系统会自动创建活动记录，无需提示「未找到活动」。',
    metadata: { topic: 'ticket' },
  }),
  new Document({
    pageContent:
      '拼单类型包括酒店拼房（hotel）与交通拼单（transport）。可说明出发地、日期、人数与预算，助手会检索开放中的拼单。',
    metadata: { topic: 'pindan' },
  }),
  new Document({
    pageContent:
      '平台支持 AI 匹配活动、查询拼单、协助出票收票。回答应简洁、可执行，并在需要时引导用户补充日期、人数、预算。',
    metadata: { topic: 'assistant' },
  }),
];
