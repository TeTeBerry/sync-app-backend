import { Document } from '@langchain/core/documents';
import { getFestivalVibe } from './data/festival-vibe.data';

export type ActivityKnowledgeInput = {
  code: string;
  name: string;
  alias?: string[];
  date?: string;
  location?: string;
  area?: string;
  region?: string;
  activityType?: string;
};

export function buildActivityKnowledgeDocument(
  input: ActivityKnowledgeInput,
): Document {
  const aliasText = input.alias?.length
    ? `别名：${input.alias.join('、')}。`
    : '';
  const dateText = input.date ? `档期：${input.date}。` : '';
  const locationText = input.location ? `地点：${input.location}。` : '';
  const areaText = input.area ? `区域：${input.area}。` : '';
  const regionText = input.region ? `范围：${input.region}。` : '';
  const typeText = input.activityType
    ? `类型：${input.activityType === 'indoor' ? '室内' : '户外音乐节'}。`
    : '';
  const vibeText = getFestivalVibe(input.code)
    ? `曲风气质：${getFestivalVibe(input.code)}。`
    : '';

  return new Document({
    pageContent:
      `${input.name}（${input.code}）${dateText}${locationText}${areaText}${regionText}${typeText}${vibeText}${aliasText}`.trim(),
    metadata: { topic: 'activity', code: input.code },
  });
}
