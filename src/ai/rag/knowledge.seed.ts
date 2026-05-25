import { Document } from '@langchain/core/documents';

/** 音乐节 / 拼单 / 票务 FAQ，供 RAG 入库 */
export const KNOWLEDGE_DOCUMENTS: Document[] = [
  new Document({
    pageContent:
      'EDC China 电音节（edc）通常在年中举办，主打电子舞曲。常见需求：门票转让、酒店拼房、上海/本地出发交通拼单。',
    metadata: { topic: 'activity', code: 'edc' },
  }),
  new Document({
    pageContent:
      'S2O 三亚泼水音乐节（s2o）是户外电音节，常含泼水环节。热门拼单：三亚海景酒店、浦东/各地飞三亚机票、机场接驳。',
    metadata: { topic: 'activity', code: 's2o' },
  }),
  new Document({
    pageContent:
      'Ultra 上海（ultra）为国际电音节品牌上海站。用户常咨询单日/通票、阵容、场馆交通与周边住宿。',
    metadata: { topic: 'activity', code: 'ultra' },
  }),
  new Document({
    pageContent:
      '出票流程：依次确认活动名称、演出日期、票种、数量、价格、联系方式（微信或手机号）；信息齐全后直接创建出售挂单，勿询问是否发布或同步拼单群。收票流程：确认活动、日期、票种、数量、预算与联系方式后直接创建求购挂单。',
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
