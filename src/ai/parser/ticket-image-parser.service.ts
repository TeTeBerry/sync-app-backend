import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { LlmService } from '../llm/llm.service';
import {
  decodeBase64Payload,
  toDataUrl,
} from '../utils/image-base64.util';
import type { LlmTicketSlotResult } from './llm-slot-parser.types';

@Injectable()
export class TicketImageParserService {
  constructor(
    private readonly llm: LlmService,
    private readonly activityService: ActivityService,
  ) {}

  private async activityCatalog(): Promise<string> {
    const rows = await this.activityService.findAll();
    return rows.map(item => `${item.code}=${item.name}`).join(', ');
  }

  /** 千问 VL：从门票截图抽取结构化字段，temperature=0.1 */
  async parseTicketImage(
    image: string,
    listingType: 'sell' | 'buy',
    userHint?: string,
  ): Promise<LlmTicketSlotResult | null> {
    if (!this.llm.visionEnabled || !image?.trim()) return null;

    const { mimeType, base64 } = decodeBase64Payload(image);
    const catalog = await this.activityCatalog();
    const system = [
      '你是门票 OCR 抽取器。从用户上传的门票/购票截图中提取出票/收票挂单字段。',
      '严格规则：',
      '1. 只输出一个 JSON 对象，不要 markdown，不要解释。',
      '2. 仅提取图片中清晰可见的信息；看不见或不确定的字段必须为 null，禁止猜测或编造。',
      '3. 年份必须与图片中印刷/显示的一致，禁止自行推断、修改或补全年份。',
      '4. 不要把年份(1900-2100)当作 price。',
      '5. activityId 只能是 edc / edc-thailand / s2o / ultra / tomorrowland 或 null；若无法对应平台活动则 activityId 为 null。',
      '6. activityKeyword 填写截图中完整活动名称（如订单页/票面标题），不要填 UI 按钮文案。',
      '7. eventDate 格式 YYYY-MM-DD；skuCode 为票种/票档；quantity 为张数；price 为单价（元/张）。',
      '8. contact 仅当图片中有手机号/微信等联系方式时填写，否则 null。',
      `9. 当前流程类型：${listingType === 'buy' ? '收票' : '出票'}。`,
      `10. 平台活动：${catalog}`,
    ].join('\n');

    const userText =
      userHint?.trim() ||
      '请从这张门票/购票截图中提取活动、日期、票种、数量、单价等可见字段。';

    return this.llm.invokeVisionJson<LlmTicketSlotResult>(
      system,
      userText,
      toDataUrl(mimeType, base64),
    );
  }
}
