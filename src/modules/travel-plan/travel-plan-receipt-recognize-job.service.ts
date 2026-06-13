import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { isCloudStorageFileId } from '../../common/media/user-image-ref.util';
import {
  TravelPlanReceiptRecognizeJob,
  TravelPlanReceiptRecognizeJobDocument,
  type TravelPlanReceiptRecognizeJobStatus,
} from '../../database/schemas/travel-plan-receipt-recognize-job.schema';
import type { RecognizeTravelPlanReceiptResult } from '../../shared/travel-plan';
import type { RecognizeTravelPlanReceiptDto } from './dto/recognize-travel-plan-receipt.dto';
import { TravelPlanReceiptRecognizeService } from './travel-plan-receipt-recognize.service';

const JOB_TTL_MS = 30 * 60 * 1000;

export type TravelPlanReceiptRecognizeJobView = {
  jobId: string;
  status: TravelPlanReceiptRecognizeJobStatus;
  result?: RecognizeTravelPlanReceiptResult;
  errorMessage?: string;
};

@Injectable()
export class TravelPlanReceiptRecognizeJobService {
  private readonly logger = new Logger(
    TravelPlanReceiptRecognizeJobService.name,
  );

  constructor(
    @InjectModel(TravelPlanReceiptRecognizeJob.name)
    private readonly model: Model<TravelPlanReceiptRecognizeJobDocument>,
    private readonly recognizeService: TravelPlanReceiptRecognizeService,
  ) {}

  async createJob(
    activityLegacyId: number,
    dto: RecognizeTravelPlanReceiptDto,
    actor: RequestActor,
  ): Promise<{ jobId: string }> {
    const image = dto.image?.trim() ?? '';
    if (!isCloudStorageFileId(image)) {
      throw new BadRequestException('请先将截图上传到云存储');
    }

    const jobId = randomUUID();
    const expiresAt = new Date(Date.now() + JOB_TTL_MS);

    await this.model.create({
      jobId,
      activityLegacyId,
      ownerUserId: actor.resolvedUserId,
      status: 'pending',
      requestParams: dto,
      expiresAt,
    });

    void this.runJob(jobId, activityLegacyId, dto).catch((error) => {
      this.logger.error(
        `receipt recognize job ${jobId} crashed: ${
          error instanceof Error ? error.message : error
        }`,
      );
    });

    return { jobId };
  }

  async getJob(
    jobId: string,
    actor: RequestActor,
  ): Promise<TravelPlanReceiptRecognizeJobView> {
    const doc = await this.model.findOne({ jobId }).lean();
    if (!doc) {
      throw new NotFoundException('截图识别任务不存在或已过期');
    }
    if (doc.ownerUserId !== actor.resolvedUserId) {
      throw new ForbiddenException('无权查看该截图识别任务');
    }

    return {
      jobId: doc.jobId,
      status: doc.status,
      result: doc.result,
      errorMessage: doc.errorMessage,
    };
  }

  private async runJob(
    jobId: string,
    activityLegacyId: number,
    dto: RecognizeTravelPlanReceiptDto,
  ): Promise<void> {
    try {
      const result = await this.recognizeService.recognize(
        activityLegacyId,
        dto,
      );
      await this.model.updateOne(
        { jobId },
        { $set: { status: 'completed', result, errorMessage: undefined } },
      );
    } catch (error) {
      const message = formatReceiptRecognizeJobError(error);
      await this.model.updateOne(
        { jobId },
        { $set: { status: 'failed', errorMessage: message } },
      );
    }
  }
}

function formatReceiptRecognizeJobError(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string' && response.trim()) {
      return response.trim();
    }
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.join('；');
      }
      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return '截图识别失败，请稍后重试';
}
