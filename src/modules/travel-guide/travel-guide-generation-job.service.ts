import {
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
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobDocument,
} from '../../database/schemas/travel-guide-generation-job.schema';
import type { TravelGuideGenerationJobStatus } from '@src/shared/travel-guide';
import { ActivityService } from '../activity/activity.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import type {
  TravelGuideGenerationJobResult,
  TravelGuidePlan,
} from '@src/shared/travel-guide';
import { parseActivityDayCount } from './domain/parse-activity-days.util';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
} from './domain/travel-guide-generation-cache.util';
import { TravelGuideGenerationService } from './travel-guide-generation.service';
import { BffReadCacheInvalidationService } from '../../infra/cache/bff-read-cache.service';

const JOB_TTL_MS = 60 * 60 * 1000;
const ACTIVE_JOB_STATUSES: TravelGuideGenerationJobStatus[] = [
  'pending',
  'running',
];

export type TravelGuideGenerationJobView = TravelGuideGenerationJobResult;

@Injectable()
export class TravelGuideGenerationJobService {
  private readonly logger = new Logger(TravelGuideGenerationJobService.name);

  constructor(
    @InjectModel(TravelGuideGenerationJob.name)
    private readonly model: Model<TravelGuideGenerationJobDocument>,
    private readonly generationService: TravelGuideGenerationService,
    private readonly activityService: ActivityService,
    private readonly bffCacheInvalidation: BffReadCacheInvalidationService,
  ) {}

  async createJob(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
  ): Promise<{ jobId: string }> {
    const dedupeKey = await this.buildDedupeKey(activityLegacyId, dto);
    const existing = await this.model
      .findOne({
        ownerUserId: actor.resolvedUserId,
        dedupeKey,
        status: { $in: ACTIVE_JOB_STATUSES },
      })
      .lean()
      .exec();

    if (existing) {
      this.logger.debug(
        `travel guide job deduped activity=${activityLegacyId} job=${existing.jobId}`,
      );
      return { jobId: existing.jobId };
    }

    const jobId = randomUUID();
    const expiresAt = new Date(Date.now() + JOB_TTL_MS);

    await this.model.create({
      jobId,
      activityLegacyId,
      ownerUserId: actor.resolvedUserId,
      dedupeKey,
      status: 'pending',
      requestParams: dto,
      expiresAt,
    });

    void this.runJob(jobId, activityLegacyId, dto, actor).catch((error) => {
      this.logger.error(
        `travel guide job ${jobId} crashed: ${
          error instanceof Error ? error.message : error
        }`,
      );
    });

    return { jobId };
  }

  async getJob(
    jobId: string,
    actor: RequestActor,
  ): Promise<TravelGuideGenerationJobView> {
    const doc = await this.model.findOne({ jobId }).lean();
    if (!doc) {
      throw new NotFoundException('攻略生成任务不存在或已过期');
    }
    if (doc.ownerUserId !== actor.resolvedUserId) {
      throw new ForbiddenException('无权查看该攻略生成任务');
    }

    return {
      jobId: doc.jobId,
      status: doc.status,
      plan: doc.plan,
      errorMessage: doc.errorMessage,
    };
  }

  private async buildDedupeKey(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
  ): Promise<string> {
    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity?.date);
    return buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        activityLegacyId,
        dto,
        accommodationNights,
      ),
    );
  }

  private async runJob(
    jobId: string,
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
  ): Promise<void> {
    const started = await this.model.updateOne(
      { jobId, status: 'pending' },
      { $set: { status: 'running' } },
    );
    if (started.modifiedCount === 0) {
      return;
    }

    try {
      const { plan } = await this.generationService.generate(
        activityLegacyId,
        dto,
        actor,
      );
      await this.model.updateOne(
        { jobId },
        { $set: { status: 'completed', plan, errorMessage: undefined } },
      );
      await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
        actor.resolvedUserId,
        activityLegacyId,
      );
    } catch (error) {
      const message = formatTravelGuideJobError(error);
      await this.model.updateOne(
        { jobId },
        { $set: { status: 'failed', errorMessage: message } },
      );
    }
  }
}

function formatTravelGuideJobError(error: unknown): string {
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
  return '攻略生成失败，请稍后重试';
}
