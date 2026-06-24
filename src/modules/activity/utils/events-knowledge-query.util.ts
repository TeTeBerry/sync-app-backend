import type { EventsActivitySearchParsed } from '@sync/scene-contracts';
import { resolveCanonicalNameFromChineseAlias } from '../../dj/dj-chinese-aliases.util';
import type { KnowledgeTopic } from '../../../infra/chroma/build-static-knowledge-documents.util';

const LINEUP_HINT_QUERY =
  /官宣|阵容|什么时候公布|何时公布|几点公布|timetable|lineup|公布时间/;
const STORY_QUERY = /是什么|介绍|故事|背景|怎么样|值得去吗|什么样/;
const SURVIVAL_QUERY = /生存|必备|带什么|穿什么|天气|攻略|准备什么/;
const DJ_QUERY =
  /dj|艺人|谁演|headliner|小马丁|硬好|教主|潮爷|外号|马丁|garrix/i;

export function resolveKnowledgeQueryTopics(
  query: string,
  parsed: EventsActivitySearchParsed,
): KnowledgeTopic[] | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  if (parsed.intent === 'travel') {
    return ['travel', 'survival', 'activity'];
  }
  if (parsed.intent === 'ecosystem') {
    return ['ecosystem'];
  }
  if (parsed.intent === 'compare') {
    return ['activity', 'story', 'survival'];
  }

  if (LINEUP_HINT_QUERY.test(trimmed)) {
    return ['lineup_hint', 'activity'];
  }
  if (SURVIVAL_QUERY.test(trimmed)) {
    return ['survival', 'travel', 'activity'];
  }
  if (STORY_QUERY.test(trimmed)) {
    return ['story', 'activity'];
  }

  if (DJ_QUERY.test(trimmed) || resolveCanonicalNameFromChineseAlias(trimmed)) {
    return ['dj', 'activity'];
  }

  return undefined;
}

export function rankKnowledgeDocumentsForIntent<
  T extends { metadata?: Record<string, unknown> },
>(docs: T[], topics: KnowledgeTopic[] | undefined): T[] {
  if (!topics?.length) return docs;

  const priority = new Map(topics.map((topic, index) => [topic, index]));
  return [...docs].sort((left, right) => {
    const leftTopic = String(left.metadata?.topic ?? '');
    const rightTopic = String(right.metadata?.topic ?? '');
    const leftRank = priority.get(leftTopic as KnowledgeTopic) ?? 99;
    const rightRank = priority.get(rightTopic as KnowledgeTopic) ?? 99;
    return leftRank - rightRank;
  });
}

const CURATED_SOURCE_ZH = '运营整理 FAQ';
const CURATED_SOURCE_EN = 'Curated FAQ';

export function appendCuratedChromaSections(input: {
  sections: { heading?: string; body: string }[];
  chromaDocs: { pageContent: string; metadata?: Record<string, unknown> }[];
  sources: Set<string>;
  isEn: boolean;
}): void {
  const { sections, chromaDocs, sources, isEn } = input;
  const faqSource = isEn ? CURATED_SOURCE_EN : CURATED_SOURCE_ZH;
  const first = (topic: KnowledgeTopic) =>
    chromaDocs.find((doc) => doc.metadata?.topic === topic);

  const dj = first('dj');
  if (dj) {
    sections.push({
      heading: isEn ? 'Artist' : '艺人',
      body: dj.pageContent,
    });
    sources.add(faqSource);
  }

  const lineup = first('lineup_hint');
  if (lineup) {
    sections.push({
      heading: isEn ? 'Lineup announce (reference)' : '阵容官宣参考',
      body: lineup.pageContent,
    });
    sources.add(faqSource);
  }

  const story = first('story');
  if (story) {
    sections.push({
      heading: isEn ? 'About this festival' : '关于这场节',
      body: story.pageContent,
    });
    sources.add(faqSource);
  }

  const survival = first('survival');
  if (survival) {
    sections.push({
      heading: isEn ? 'Survival tips' : '现场生存提示',
      body: survival.pageContent,
    });
    sources.add(faqSource);
  }

  for (const doc of chromaDocs
    .filter((d) => d.metadata?.topic === 'activity')
    .slice(0, 2)) {
    sections.push({ body: doc.pageContent });
    sources.add(faqSource);
  }
}
