import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import {
  decodeBase64Payload,
  toDataUrl,
} from '../utils/image-base64.util';
import type { AgentParseInput, ParsedPostDraft } from './agent.types';

interface LlmImageParseResult {
  eventName?: string;
  eventTime?: string;
  time?: string;
  location?: string;
  buddyType?: string;
  description?: string;
  body?: string;
  tags?: string[];
  activityKeyword?: string;
  activityLegacyId?: number;
  ready?: boolean;
}

const IMAGE_PARSE_SYSTEM = [
  '你是 ImageParseAgent，解析门票/订单/活动截图中的组队相关信息。',
  '只输出 JSON，字段：',
  '- eventName: 活动名称',
  '- eventTime: 活动时间',
  '- location: 地点',
  '- buddyType: 组队类型（住宿/拼车/观演等）',
  '- description: 组队需求描述（50字内）',
  '- tags: 带 # 前缀标签数组',
  '- activityKeyword, activityLegacyId, ready',
  '忽略或脱敏订单号、手机号、身份证号、完整姓名，不要在输出中保留。',
].join('\n');

const PHONE_PATTERN = /1\d{10}/g;
const ID_PATTERN = /\d{17}[\dXx]/g;

function desensitizeText(value?: string): string {
  if (!value?.trim()) return '';
  return value
    .replace(PHONE_PATTERN, '***')
    .replace(ID_PATTERN, '***')
    .trim();
}

function normalizeTags(raw?: string[]): string[] {
  const tags = new Set<string>();
  for (const item of raw ?? []) {
    const trimmed = desensitizeText(item);
    if (!trimmed) continue;
    tags.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`);
  }
  return [...tags];
}

@Injectable()
export class ImageParseAgent {
  readonly id = 'image-parse';

  constructor(private readonly llmService: LlmService) {}

  async parse(input: AgentParseInput): Promise<ParsedPostDraft | null> {
    const imageRaw = input.image?.trim();
    if (!imageRaw) return null;

    const { mimeType, base64 } = decodeBase64Payload(imageRaw);
    const dataUrl = toDataUrl(mimeType, base64);

    const history = input.messages
      .slice(-6)
      .map(message => `${message.role}: ${message.content}`)
      .join('\n');

    const userPrompt = [
      input.activityLegacyId != null
        ? `当前活动 legacyId: ${input.activityLegacyId}`
        : '',
      input.input.trim() ? `用户补充说明: ${input.input.trim()}` : '',
      history ? `对话历史:\n${history}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const parsed = await this.llmService.invokeVisionJson<LlmImageParseResult>(
      IMAGE_PARSE_SYSTEM,
      userPrompt || '请解析图片中的活动与组队信息',
      dataUrl,
    );
    if (!parsed) return null;

    const description = desensitizeText(
      parsed.description?.trim() || parsed.body?.trim() || '',
    );
    const eventTime = desensitizeText(
      parsed.eventTime?.trim() || parsed.time?.trim(),
    );
    const location = desensitizeText(parsed.location?.trim());
    const eventName = desensitizeText(
      parsed.eventName?.trim() || parsed.activityKeyword?.trim(),
    );

    let body = description;
    if (!body && eventName) {
      const parts = [eventName, eventTime, location, parsed.buddyType?.trim()]
        .filter(Boolean)
        .join(' · ');
      body = parts ? `根据截图识别：${parts}，求组队同行` : '';
    }

    return {
      body,
      description,
      eventName,
      eventTime,
      location,
      buddyType: desensitizeText(parsed.buddyType?.trim()),
      tags: normalizeTags(parsed.tags),
      activityKeyword: eventName || parsed.activityKeyword?.trim(),
      activityLegacyId: parsed.activityLegacyId ?? input.activityLegacyId,
      ready: Boolean(parsed.ready !== false && body.length >= 4),
    };
  }
}
