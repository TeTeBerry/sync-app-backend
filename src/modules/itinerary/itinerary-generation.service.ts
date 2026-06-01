import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ItineraryGenerationLog,
  ItineraryGenerationLogDocument,
} from '../../database/schemas/itinerary-generation-log.schema';
import type { ItineraryDay } from '../../database/schemas/user-itinerary.schema';
import { ActivityService } from '../activity/activity.service';
import { buildFallbackItinerary } from './domain/itinerary-fallback.builder';
import type { ItineraryConflict } from './domain/itinerary-conflict.util';
import { ItineraryCacheService } from './itinerary-cache.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';

export interface GenerateItineraryResult {
  itinerary: {
    eventMeta: string;
    days: ItineraryDay[];
  };
  conflicts: ItineraryConflict[];
  cached: boolean;
}

@Injectable()
export class ItineraryGenerationService {
  private readonly logger = new Logger(ItineraryGenerationService.name);

  constructor(
    @InjectModel(ItineraryGenerationLog.name)
    private readonly logModel: Model<ItineraryGenerationLogDocument>,
    private readonly activityService: ActivityService,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly cache: ItineraryCacheService,
  ) {}

  async generate(input: {
    activityLegacyId: number;
    selectedDjIds: string[];
    dateKey?: string;
    userId: string;
  }): Promise<GenerateItineraryResult> {
    const selectedDjIds = [
      ...new Set(input.selectedDjIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (selectedDjIds.length === 0) {
      throw new BadRequestException('selectedDjIds must not be empty');
    }

    const allowed = await this.cache.checkRateLimit(
      input.userId,
      input.activityLegacyId,
    );
    if (!allowed) {
      throw new HttpException(
        '行程生成过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const lockOk = await this.cache.acquireGenerateLock(
      input.userId,
      input.activityLegacyId,
    );
    if (!lockOk) {
      throw new HttpException(
        '正在生成行程，请勿重复提交',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const { sessions, performances } =
        await this.scheduleService.loadPerformances(
          input.activityLegacyId,
          input.dateKey,
        );

      const primaryDateKey = input.dateKey ?? sessions[0]?.dateKey ?? 'jun13';

      const cached =
        await this.cache.getGenerationCache<GenerateItineraryResult>(
          input.activityLegacyId,
          primaryDateKey,
          selectedDjIds,
        );
      if (cached) {
        return { ...cached, cached: true };
      }

      const activity = await this.activityService.findByLegacyId(
        input.activityLegacyId,
      );
      if (!activity) {
        throw new NotFoundException(
          `Activity ${input.activityLegacyId} not found`,
        );
      }

      const conflicts = this.scheduleService.detectConflicts(
        performances,
        selectedDjIds,
      );

      const itinerary = buildFallbackItinerary({
        eventMeta: activity.name,
        sessions,
        performances,
        selectedDjIds,
        primaryDateKey,
      });

      const result: GenerateItineraryResult = {
        itinerary,
        conflicts,
        cached: false,
      };

      await this.cache.setGenerationCache(
        input.activityLegacyId,
        primaryDateKey,
        selectedDjIds,
        result,
      );

      void this.logModel
        .create({
          userId: input.userId,
          activityLegacyId: input.activityLegacyId,
          selectedDjIds,
          cached: false,
          meta: { conflictCount: conflicts.length, dateKey: primaryDateKey },
        })
        .catch((err) => {
          this.logger.warn(
            `Itinerary generation log write failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });

      return result;
    } finally {
      await this.cache.releaseGenerateLock(
        input.userId,
        input.activityLegacyId,
      );
    }
  }
}
