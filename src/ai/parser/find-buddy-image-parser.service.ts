import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { LlmService } from '../llm/llm.service';
import { decodeBase64Payload, toDataUrl } from '../utils/image-base64.util';
import type { LlmFindBuddyVisionResult } from './llm-slot-parser.types';

@Injectable()
export class FindBuddyImageParserService {
  constructor(
    private readonly llm: LlmService,
    private readonly activityService: ActivityService,
  ) {}

  private async activityCatalog(): Promise<string> {
    const rows = await this.activityService.findAll();
    return rows.map(item => `${item.code}=${item.name}`).join(', ');
  }

  /** 千问 VL：从套餐/酒店订单截图抽取找搭子字段 */
  async parseFindBuddyImage(
    image: string,
    userHint?: string,
  ): Promise<LlmFindBuddyVisionResult | null> {
    if (!this.llm.visionEnabled || !image?.trim()) return null;

    const { mimeType, base64 } = decodeBase64Payload(image);
    const catalog = await this.activityCatalog();
    const system = [
      '你是音乐节出行/拼单信息 OCR 抽取器。从用户上传的套餐订单、酒店订单、机酒套餐截图中提取找搭子所需字段。',
      '严格规则：',
      '1. 只输出一个 JSON 对象，不要 markdown，不要解释。',
      '2. 仅提取图片中清晰可见的信息；看不见或不确定的字段必须为 null，禁止猜测或编造。',
      '3. 年份必须与图片中一致；若图片无年份则 eventDate 只填月日对应最近合理年份或 null。',
      '4. activityKeyword 填活动/音乐节完整名称（如 VAC 珠海电音节、Vision & Colour、EDC China），不要填按钮文案。',
      '5. activityId 只能是 edc / edc-thailand / s2o / ultra / tomorrowland / vac-zhuhai 或 null；默认必须为 null，禁止猜测。',
      '6. 禁止因「电音节 / 音乐节 / Music Festival」等泛称推断 activityId；无明确平台活动名时 activityId=null，活动名写入 activityKeyword。',
      '7. 看到 VAC、Vision & Colour、Heineken Soundscape、珠海+希尔顿套餐 → activityId=vac-zhuhai。',
      '8. 仅当图片明确出现 EDC / EDC China / EDC Thailand 字样且与 VAC 无关时，才可填 edc / edc-thailand。',
      '9. packageName 为套餐产品名（如「珠海希尔顿酒店 3天2晚」）；hotelName 为酒店名；location 为城市或地址。',
      '10. eventDate 格式 YYYY-MM-DD（取入住/活动开始日期）；peopleCount 仅在明确写「X人/X位/大床/双床/双人房型」时填写；若仅有大床/双床/双人套餐则 peopleCount=2，禁止从「双人早餐」单独推断。',
      '11. packagePrice 填套餐/订单总价（如海报底部 1738 元、3天2晚标价）；priceUnit 填 total 或 per_person。',
      '12. budget 仅当图片明确标注「人均/每人/元/人」时填写；酒店套餐标价默认是总价 → 填 packagePrice + priceUnit=total，不要填 budget。',
      '13. transportNote 提取交通/穿梭巴士说明（如「不含穿梭巴士 50rmb/人/日 80rmb/人/两日」），原样精简写入。',
      '14. city 为出发/所在城市（如珠海）；不要把年份当作价格。',
      '15. 若海报/截图同时列出多个套餐（如「3天2晚 ¥1080」与「4天3晚 ¥1580」），必须填入 packageOptions 数组，每项含 packageName/duration、packagePrice、eventDate；此时顶层 packagePrice/packageName/eventDate 必须为 null，禁止自动选一个。',
      '16. 仅有一个套餐时：packageOptions 为 null 或单元素数组，可填顶层 packagePrice/packageName/eventDate。',
      `17. 平台活动：${catalog}`,
    ].join('\n');

    const userText =
      userHint?.trim() ||
      '请从这张套餐/酒店/出行订单截图中提取活动、日期、人数、城市、套餐名、酒店名、套餐总价、交通说明等可见字段。';

    return this.llm.invokeVisionJson<LlmFindBuddyVisionResult>(
      system,
      userText,
      toDataUrl(mimeType, base64),
    );
  }
}
