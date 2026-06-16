import { Injectable } from '@nestjs/common';
import { LlmService } from '../../infra/llm/llm.service';
import {
  buildKnownFactsSummary,
  getMissingBuddyFields,
  isShortContextReply,
  parseConversationContext,
  type ConversationContext,
} from '../conversation/conversation-context.parser';
import { formatConversationHistory } from '../utils/conversation-format.util';
import type { ChatMessageDto } from '../../shared/chat';
import type { AgentParseInput, ParsedPostDraft } from './agent.types';

interface LlmTextParseResult {
  description?: string;
  body?: string;
  eventTime?: string;
  time?: string;
  location?: string;
  tags?: string[];
  activityKeyword?: string;
  activityLegacyId?: number;
  buddyType?: string;
  ready?: boolean;
}

const TEXT_PARSE_SYSTEM = [
  '你是 TextParseAgent，从多轮对话中抽取用户组队发帖所需的结构化信息。',
  '用户常分多轮补充：先说明活动/意图，再单独回复「2人」「上海」「可以」等短句；需结合完整对话、助手追问与「已知信息摘要」判断短回复所指字段。',
  '若助手上一轮问了日期/人数/城市/预算，用户的短回复通常是在回答该问题，不要只按最新一条孤立理解。',
  '将多轮用户意图合并为一条连贯的组队需求描述（description），不要丢弃先前轮次已确认的信息。',
  '只输出 JSON，字段：',
  '- description: 合并多轮后的需求描述（50字内中文）',
  '- eventTime: 出行/活动时间',
  '- location: 地点或出发城市',
  '- tags: 字符串数组，每项带 # 前缀，如 #住宿 #女生优先',
  '- activityKeyword: 活动关键词',
  '- activityLegacyId: 数字，若用户或上下文已明确',
  '- buddyType: 组队类型，如 住宿同行/同路/观演',
  '- ready: 活动与核心出行信息（日期、人数、出发城市）是否已足够直接发帖',
].join('\n');

function normalizeTags(raw?: string[]): string[] {
  const tags = new Set<string>();
  for (const item of raw ?? []) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    tags.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`);
  }
  return [...tags];
}

function buildMergedDescription(
  parsed: LlmTextParseResult,
  ctx: ConversationContext,
  input: string,
  boundActivityLegacyId?: number,
): string {
  const llmDesc = parsed.description?.trim() || parsed.body?.trim() || '';
  const trimmedInput = input.trim();

  if (
    llmDesc &&
    llmDesc.length > 8 &&
    !isShortContextReply(llmDesc) &&
    getMissingBuddyFields(ctx, boundActivityLegacyId).length === 0
  ) {
    return llmDesc;
  }

  const leadParts: string[] = [];
  if (llmDesc && !isShortContextReply(llmDesc)) {
    leadParts.push(llmDesc);
  } else if (trimmedInput && !isShortContextReply(trimmedInput)) {
    leadParts.push(trimmedInput);
  } else if (ctx.activityKeyword) {
    leadParts.push(`找 ${ctx.activityKeyword} 同行`);
  }

  const detailParts: string[] = [];
  if (ctx.eventDate) detailParts.push(`日期 ${ctx.eventDate}`);
  if (ctx.peopleCount) detailParts.push(`${ctx.peopleCount} 人同行`);
  if (ctx.city) detailParts.push(`从 ${ctx.city} 出发`);
  if (ctx.budget) detailParts.push(`预算约 ¥${ctx.budget}/人`);
  if (ctx.genderPreference) detailParts.push(ctx.genderPreference);

  if (leadParts.length && detailParts.length) {
    return `${leadParts[0]}，${detailParts.join('，')}`;
  }
  if (detailParts.length) {
    const activity = ctx.activityKeyword ?? '活动';
    return `找 ${activity} 同行，${detailParts.join('，')}`;
  }

  return llmDesc || trimmedInput;
}

function resolveReady(
  parsed: LlmTextParseResult,
  ctx: ConversationContext,
  body: string,
  activityLegacyId?: number,
  activityKeyword?: string,
): boolean {
  if (!body.trim()) return false;

  const hasActivity = Boolean(
    activityLegacyId ??
    ctx.activityId ??
    ctx.activityKeyword ??
    ctx.activityPickerIndex ??
    activityKeyword,
  );
  if (!hasActivity) return false;

  if (Boolean(parsed.ready)) return true;
  return getMissingBuddyFields(ctx, activityLegacyId).length === 0;
}

@Injectable()
export class TextParseAgent {
  readonly id = 'text-parse';

  constructor(private readonly llmService: LlmService) {}

  async parse(input: AgentParseInput): Promise<ParsedPostDraft | null> {
    if (input.image?.trim()) {
      return null;
    }

    const trimmedInput = input.input.trim();
    const ctx = parseConversationContext(input.messages, trimmedInput);
    const knownFacts = buildKnownFactsSummary(ctx);
    const missingFields = getMissingBuddyFields(ctx, input.activityLegacyId);
    const history = formatConversationHistory(input.messages);

    const userPrompt = [
      input.activityLegacyId != null
        ? `当前活动 legacyId: ${input.activityLegacyId}`
        : '',
      `【已知信息摘要】\n${knownFacts}`,
      missingFields.length
        ? `【仍缺字段】${missingFields.join('、')}`
        : '【仍缺字段】无',
      history ? `【多轮对话】\n${history}` : '',
      trimmedInput ? `【最新用户消息】${trimmedInput}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const parsed = await this.llmService.invokeJson<LlmTextParseResult>(
      TEXT_PARSE_SYSTEM,
      userPrompt,
    );
    if (!parsed) return null;

    const activityKeyword =
      parsed.activityKeyword?.trim() || ctx.activityKeyword?.trim();
    const eventTime =
      parsed.eventTime?.trim() || parsed.time?.trim() || ctx.eventDate;
    const location = parsed.location?.trim() || ctx.city;
    const activityLegacyId = parsed.activityLegacyId ?? input.activityLegacyId;
    const description = buildMergedDescription(
      parsed,
      ctx,
      trimmedInput,
      activityLegacyId,
    );
    const body = description;
    const ready = resolveReady(
      parsed,
      ctx,
      body,
      activityLegacyId,
      activityKeyword,
    );

    return {
      body,
      description,
      eventName: activityKeyword,
      eventTime,
      location,
      buddyType: parsed.buddyType?.trim(),
      tags: normalizeTags(parsed.tags),
      activityKeyword,
      activityLegacyId,
      ready,
    };
  }
}
