import { Injectable } from '@nestjs/common';
import type { FindBuddyState } from '../conversation/conversation-state.types';
import { ActivityService } from '../../modules/activity/activity.service';
import { LlmService } from '../llm/llm.service';
import type { TicketDraft } from '../utils/ticket-draft.parser';
import type {
  LlmFindBuddySlotResult,
  LlmTicketSlotResult,
} from './llm-slot-parser.types';

@Injectable()
export class LlmSlotParserService {
  constructor(
    private readonly llm: LlmService,
    private readonly activityService: ActivityService,
  ) {}

  private async activityCatalog(): Promise<string> {
    const rows = await this.activityService.findAll();
    return rows.map(item => `${item.code}=${item.name}`).join(', ');
  }

  /** LLM 仅做槽位抽取，不生成对话、不调用工具 */
  async parseTicketSlots(
    input: string,
    currentDraft: TicketDraft,
    listingType: 'sell' | 'buy',
  ): Promise<LlmTicketSlotResult | null> {
    if (!this.llm.enabled) return null;

    const catalog = await this.activityCatalog();
    const system = [
      '你是音乐节平台的信息抽取器。',
      '任务：从用户最后一句话提取出票/收票结构化字段。',
      '严格规则：',
      '1. 只输出一个 JSON 对象，不要 markdown，不要解释。',
      '2. 用户未明确说的字段必须为 null，禁止编造。',
      '3. 不要把年份(1900-2100)当作 price。',
      '4. activityId 只能是 edc / edc-thailand / s2o / ultra / tomorrowland 或 null。',
      '5. eventDate 格式 YYYY-MM-DD；contact 可以是手机号、微信号或「微信联系」。',
      `6. 当前流程类型：${listingType === 'buy' ? '收票' : '出票'}。`,
      `7. 平台活动：${catalog}`,
    ].join('\n');

    const user = JSON.stringify({
      userMessage: input,
      currentDraft,
    });

    return this.llm.invokeJson<LlmTicketSlotResult>(system, user);
  }

  async parseFindBuddySlots(
    input: string,
    current: FindBuddyState,
  ): Promise<LlmFindBuddySlotResult | null> {
    if (!this.llm.enabled) return null;

    const catalog = await this.activityCatalog();
    const system = [
      '你是找搭子流程的信息抽取器。',
      '只输出 JSON，不要其他文字。',
      '用户未说的字段为 null，禁止编造。',
      'activityId 只能是 edc / edc-thailand / s2o / ultra / tomorrowland 或 null。',
      `平台活动：${catalog}`,
    ].join('\n');

    const user = JSON.stringify({
      userMessage: input,
      currentFindBuddy: current,
    });

    return this.llm.invokeJson<LlmFindBuddySlotResult>(system, user);
  }
}
