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
import type { TravelGuideGenerationJobStatus } from '@sync/travel-guide-contracts';
import { ActivityService } from '../activity/activity.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import type {
  TravelGuideGenerationJobResult,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import { parseActivityDayCount } from './domain/parse-activity-days.util';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
} from './domain/travel-guide-generation-cache.util';
import { resolveTravelGuideOwnerUserId } from './domain/travel-guide-owner.util';
import { TravelGuideGenerationService } from './travel-guide-generation.service';
import { BffReadCacheInvalidationService } from '../../infra/cache/bff-read-cache.service';
import {
  TRAVEL_GUIDE_PROGRESS,
  type TravelGuideProgressReporter,
} from './domain/travel-guide-generation-progress.util';

const JOB_TTL_MS = 60 * 60 * 1000;
const STALE_PENDING_JOB_MS = 90 * 1000;
/** LLM + quotes rarely exceed a few minutes; fail orphaned running jobs sooner. */
const STALE_RUNNING_JOB_MS = 4 * 60 * 1000;
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
    const ownerUserId = resolveTravelGuideOwnerUserId(actor, {
      guideId: dto.guideId,
      fallbackKey: dedupeKey,
    });

    if (dto.forceRegenerate === true) {
      await this.failActiveJobsForDedupeKey(ownerUserId, dedupeKey);
    } else {
      const existing = await this.findActiveJob(ownerUserId, dedupeKey);

      if (existing) {
        if (isStaleActiveJob(existing)) {
          await this.failJob(existing.jobId, '攻略生成任务超时，请重试');
        } else if (
          existing.status === 'pending' ||
          existing.status === 'running'
        ) {
          if (existing.status === 'pending') {
            void this.runJob(
              existing.jobId,
              activityLegacyId,
              dto,
              actor,
            ).catch((error) => {
              this.logger.error(
                `travel guide job ${existing.jobId} re-run crashed: ${
                  error instanceof Error ? error.message : error
                }`,
              );
            });
          }
          this.logger.debug(
            `travel guide job deduped activity=${activityLegacyId} job=${existing.jobId}`,
          );
          return { jobId: existing.jobId };
        }
      }
    }

    const jobId = randomUUID();
    const expiresAt = new Date(Date.now() + JOB_TTL_MS);

    await this.model.create({
      jobId,
      activityLegacyId,
      ownerUserId,
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

    return this.toJobView(doc);
  }

  /** Raven public poll — jobId is the access credential. */
  async getJobByCredential(
    jobId: string,
  ): Promise<TravelGuideGenerationJobView> {
    const doc = await this.model.findOne({ jobId }).lean();
    if (!doc) {
      throw new NotFoundException('攻略生成任务不存在或已过期');
    }
    return this.toJobView(doc);
  }

  private toJobView(
    doc: Pick<
      TravelGuideGenerationJob,
      'jobId' | 'status' | 'progress' | 'plan' | 'errorMessage'
    >,
  ): TravelGuideGenerationJobView {
    return {
      jobId: doc.jobId,
      status: doc.status,
      progress: doc.progress,
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
    const paramsKey = buildTravelGuideGenerationCacheKey(
      normalizeTravelGuideGenerationParams(
        activityLegacyId,
        dto,
        accommodationNights,
      ),
    );
    const guideId = dto.guideId?.trim();
    return guideId ? `${paramsKey}:${guideId}` : paramsKey;
  }

  private findActiveJob(ownerUserId: string, dedupeKey: string) {
    return this.model
      .findOne({
        ownerUserId,
        dedupeKey,
        status: { $in: ACTIVE_JOB_STATUSES },
      })
      .lean()
      .exec();
  }

  private async failActiveJobsForDedupeKey(
    ownerUserId: string,
    dedupeKey: string,
  ): Promise<void> {
    await this.model.updateMany(
      {
        ownerUserId,
        dedupeKey,
        status: { $in: ACTIVE_JOB_STATUSES },
      },
      {
        $set: {
          status: 'failed',
          errorMessage: '已重新生成攻略',
        },
      },
    );
  }

  private async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.model.updateOne(
      { jobId },
      { $set: { status: 'failed', errorMessage } },
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

    const onProgress = this.createJobProgressReporter(jobId);
    await onProgress(TRAVEL_GUIDE_PROGRESS.queued);

    try {
      const { plan } = await this.generationService.generate(
        activityLegacyId,
        dto,
        actor,
        { onProgress },
      );
      await this.model.updateOne(
        { jobId },
        {
          $set: {
            status: 'completed',
            plan,
            errorMessage: undefined,
            progress: TRAVEL_GUIDE_PROGRESS.completed,
          },
        },
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

  private createJobProgressReporter(
    jobId: string,
  ): TravelGuideProgressReporter {
    return async (progress) => {
      try {
        await this.model.updateOne({ jobId }, { $set: { progress } }).exec();
      } catch (error) {
        this.logger.debug(
          `travel guide job ${jobId} progress update failed: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    };
  }
}

function isStaleActiveJob(job: {
  status: TravelGuideGenerationJobStatus;
  updatedAt?: Date;
  createdAt?: Date;
}): boolean {
  const ts = job.updatedAt ?? job.createdAt;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  if (job.status === 'pending') {
    return ageMs > STALE_PENDING_JOB_MS;
  }
  if (job.status === 'running') {
    return ageMs > STALE_RUNNING_JOB_MS;
  }
  return false;
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
