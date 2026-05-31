import type { PerformanceSlot } from './itinerary-conflict.util';
import type { ItineraryConflict } from './itinerary-conflict.util';

export interface PromptPerformance extends PerformanceSlot {
  dateLabel: string;
  genre: string;
  genreLabel: string;
  stage: string;
}

export function buildFactualScheduleBlock(
  performances: PromptPerformance[],
): string {
  if (performances.length === 0) {
    return '（无官方演出数据，勿编造时间与舞台）';
  }

  return performances
    .map(
      p =>
        `[${p.artistId}] ${p.artistName} | ${p.dateLabel} ${p.startTime}-${p.endTime} | 舞台: ${p.stageLabel} (${p.stage}) | 风格: ${p.genreLabel}`,
    )
    .join('\n');
}

export function buildItineraryGenerationPrompt(input: {
  eventMeta: string;
  dateKey: string;
  dateLabel: string;
  selectedDjNames: string[];
  performances: PromptPerformance[];
  conflicts: ItineraryConflict[];
  chromaHints?: string[];
}): { system: string; user: string } {
  const factualSchedule = buildFactualScheduleBlock(input.performances);

  const conflictLines =
    input.conflicts.length > 0
      ? input.conflicts.map(c => `- ${c.message}`).join('\n')
      : '无';

  const chromaBlock =
    input.chromaHints && input.chromaHints.length > 0
      ? input.chromaHints.join('\n')
      : '无额外检索片段';

  const system = `你是专业电音节行程规划助手。根据官方演出表与用户选定的 DJ，生成个性化观演时间轴 JSON。

【硬性约束 — 禁止编造】
1. 下方 FACTUAL_SCHEDULE 是唯一可信的演出来源（艺人、开始/结束时间、舞台）；不得虚构、修改或猜测任何未出现在该表中的艺人、时段或舞台。
2. 每位用户选定 DJ 的「重点演出」节点必须使用 FACTUAL_SCHEDULE 中对应 [artistId] 行的官方 startTime（HH:mm）、artistName 与 stageLabel。
3. 若某 DJ 在 FACTUAL_SCHEDULE 中无数据，在 subtitle 中说明「暂无官方排期」，不要编造演出时间与舞台。
4. 仅输出一个 JSON 对象，不要 markdown 或解释。
5. 必须包含用户选定的全部 DJ 的演出节点。
6. 可插入合理的出行、休息、转场节点（出发、安检、餐饮等）；这些节点的时间可合理推断，但不得与官方演出时间矛盾。
7. 若存在时间冲突，在冲突 DJ 的 subtitle 中简短提示转场，但仍保留双方演出。
8. dotColor 仅使用 pink、cyan、purple；pill.variant 仅 green 或 pink。
9. 用户选定 DJ 的演出项 highlighted=true，并加 pill「重点演出 · 必看」variant=pink。

JSON 结构：
{
  "eventMeta": string,
  "days": [{
    "id": string,
    "label": string,
    "bannerDateLabel": string,
    "nodeCount": number,
    "items": [{
      "id": string,
      "time": "HH:mm",
      "dotColor": "pink"|"cyan"|"purple",
      "title": string,
      "subtitle"?: string,
      "timeTag"?: string,
      "timeTagColor"?: "pink"|"cyan"|"purple",
      "pill"?: { "label": string, "variant": "green"|"pink" },
      "highlighted"?: boolean
    }]
  }]
}`;

  const user = `活动：${input.eventMeta}
目标日期：${input.dateLabel} (${input.dateKey})
用户选定 DJ：${input.selectedDjNames.join('、')}

FACTUAL_SCHEDULE（官方演出表，时间与舞台必须与此一致）：
${factualSchedule}

时间冲突警告（需在文案中体现，但仍保留演出）：
${conflictLines}

向量检索补充（仅供参考，若与 FACTUAL_SCHEDULE 冲突以 FACTUAL_SCHEDULE 为准）：
${chromaBlock}

请生成以「${input.dateKey}」为主的时间轴（可含相邻日若演出跨日），nodeCount 等于 items 长度。`;

  return { system, user };
}
