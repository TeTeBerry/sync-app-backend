import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LlmService } from '../../infra/llm/llm.service';
import {
  decodeBase64Payload,
  toDataUrl,
} from '../../ai/utils/image-base64.util';
import { assertUserUgcImageDataUrl } from '../../common/media/user-ugc-image.util';
import { isCloudStorageFileId } from '../../common/media/user-image-ref.util';
import { CloudStorageService } from '../../infra/cloud/cloud-storage.service';
import { ActivityService } from '../activity/activity.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import type { RecognizeTravelPlanReceiptDto } from './dto/recognize-travel-plan-receipt.dto';
import {
  buildTravelPlanReceiptSystemPrompt,
  buildTravelPlanReceiptUserPrompt,
} from './domain/travel-plan-receipt-recognize.prompt';
import {
  type LlmTravelPlanReceiptResult,
  normalizeTravelPlanReceiptResult,
} from './domain/travel-plan-receipt-normalize.util';

@Injectable()
export class TravelPlanReceiptRecognizeService {
  private readonly logger = new Logger(TravelPlanReceiptRecognizeService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly activityService: ActivityService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly cloudStorage: CloudStorageService,
  ) {}

  private async resolveReceiptImage(ref: string): Promise<string> {
    const trimmed = ref.trim();
    if (!trimmed) {
      throw new BadRequestException('请上传截图');
    }

    if (isCloudStorageFileId(trimmed)) {
      return this.cloudStorage.fetchUgcImageAsDataUrl(trimmed);
    }

    if (/^data:image\//i.test(trimmed)) {
      const { mimeType, base64 } = decodeBase64Payload(trimmed);
      return toDataUrl(mimeType, base64);
    }

    throw new BadRequestException('请提交本地截图进行识别');
  }

  private async assertReceiptImageSafe(imageRef: string): Promise<void> {
    const trimmed = imageRef.trim();
    if (isCloudStorageFileId(trimmed)) {
      return;
    }
    if (/^data:image\//i.test(trimmed)) {
      await assertUserUgcImageDataUrl(this.wechatContentSecurity, trimmed);
    }
  }

  async recognize(
    activityLegacyId: number,
    dto: RecognizeTravelPlanReceiptDto,
  ) {
    if (!this.llmService.visionEnabled) {
      throw new ServiceUnavailableException('截图识别服务暂不可用，请稍后重试');
    }

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    const imageDataUrl = await this.resolveReceiptImage(dto.image);
    await this.assertReceiptImageSafe(dto.image);

    const parsed =
      await this.llmService.invokeVisionJson<LlmTravelPlanReceiptResult>(
        buildTravelPlanReceiptSystemPrompt(dto.category),
        buildTravelPlanReceiptUserPrompt({
          category: dto.category,
          activityName: activity?.name,
        }),
        imageDataUrl,
      );

    if (!parsed) {
      this.logger.warn(
        `Travel plan receipt vision returned empty (activity=${activityLegacyId}, category=${dto.category})`,
      );
      return normalizeTravelPlanReceiptResult(dto.category, null);
    }

    const yearHint = extractActivityYearHint(activity?.date, activity?.name);
    return normalizeTravelPlanReceiptResult(dto.category, parsed, { yearHint });
  }
}

function extractActivityYearHint(
  activityDate?: string | null,
  activityName?: string | null,
): string | undefined {
  const fromDate = activityDate?.match(/\b(20\d{2})\b/)?.[1];
  if (fromDate) {
    return fromDate;
  }

  const fromName = activityName?.match(/\b(20\d{2})\b/)?.[1];
  if (fromName) {
    return fromName;
  }

  return String(new Date().getFullYear());
}
