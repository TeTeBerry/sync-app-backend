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
import { LlmService } from '../../ai/llm/llm.service';
import { ActivityService } from '../activity/activity.service';
import { buildItineraryGenerationPrompt } from './domain/itinerary-prompt.builder';
import { validateItineraryAgainstFactualSchedule } from './domain/itinerary-factual.validator';
import { parseItineraryGenerationResponse } from './domain/itinerary-response.parser';
import type { PromptPerformance } from './domain/itinerary-prompt.builder';
import { buildFallbackItinerary } from './domain/itinerary-fallback.builder';
import type { ItineraryConflict } from './domain/itinerary-conflict.util';
import { ItineraryCacheService } from './itinerary-cache.service';
import { ItineraryChromaService } from './itinerary-chroma.service';
import { ItineraryScheduleService } from './itinerary-schedule.service';

export interface GenerateItineraryResult {
  itinerary: {
    eventMeta: string;
    days: ItineraryDay[];
  };
  conflicts: ItineraryConflict[];
  cached: boolean;
  llmUsed: boolean;
}

@Injectable()
export class ItineraryGenerationService {
  private readonly logger = new Logger(ItineraryGenerationService.name);

  constructor(
    @InjectModel(ItineraryGenerationLog.name)
    private readonly logModel: Model<ItineraryGenerationLogDocument>,
    private readonly llm: LlmService,
    private readonly activityService: ActivityService,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly cache: ItineraryCacheService,
    private readonly chroma: ItineraryChromaService,
  ) {}

  async generate(input: {
    activityLegacyId: number;
    selectedDjIds: string[];
    dateKey?: string;
    userId: string;
  }): Promise<GenerateItineraryResult> {
    const selectedDjIds = [
      ...new Set(
        input.selectedDjIds.map(id => id.trim()).filter(Boolean),
      ),
    ];
    if (selectedDjIds.length === 0) {
      throw new BadRequestException('selectedDjIds must not be empty');
    }
    if (selectedDjIds.length > 5) {
      throw new BadRequestException('At most 5 DJs can be selected');
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
      const activity = await this.activityService.findByLegacyId(
        input.activityLegacyId,
      );
      if (!activity) {
        throw new NotFoundException(
          `Activity ${input.activityLegacyId} not found`,
        );
      }

      const { sessions, performances } =
        await this.scheduleService.loadPerformances(
          input.activityLegacyId,
          input.dateKey,
        );

      const primaryDateKey =
        input.dateKey ?? sessions[0]?.dateKey ?? 'jun13';

      const conflicts = this.scheduleService.detectConflicts(
        performances,
        selectedDjIds,
      );

      const cached = await this.cache.getGenerationCache<GenerateItineraryResult>(
        input.activityLegacyId,
        primaryDateKey,
        selectedDjIds,
      );
      if (cached) {
        return { ...cached, cached: true };
      }

      const selectedNames = selectedDjIds.map(id => {
        const perf = performances.find(p => p.artistId === id);
        return perf?.artistName ?? id;
      });

      const { performances: factualPerfs, hints: chromaHints } =
        await this.chroma.resolveFactualPerformances({
          activityLegacyId: input.activityLegacyId,
          selectedDjIds,
          mongoPerformances: performances,
          dateKey: input.dateKey,
          primaryDateKey,
        });

      const promptPerformances: PromptPerformance[] = factualPerfs.map(p => ({
        artistId: p.artistId,
        artistName: p.artistName,
        dateKey: p.dateKey,
        dateLabel: p.dateLabel,
        startMinutes: p.startMinutes,
        endMinutes: p.endMinutes,
        startTime: p.startTime,
        endTime: p.endTime,
        stageLabel: p.stageLabel,
        genre: p.genre,
        genreLabel: p.genreLabel,
        stage: p.stage,
      }));

      const session = sessions.find(s => s.dateKey === primaryDateKey);
      const dateLabel =
        session?.label ?? factualPerfs[0]?.dateLabel ?? primaryDateKey;

      let llmUsed = false;
      let itinerary = buildFallbackItinerary({
        eventMeta: activity.name,
        sessions,
        performances,
        selectedDjIds,
        primaryDateKey,
      });

      if (this.llm.enabled) {
        const { system, user } = buildItineraryGenerationPrompt({
          eventMeta: activity.name,
          dateKey: primaryDateKey,
          dateLabel,
          selectedDjNames: selectedNames,
          performances: promptPerformances,
          conflicts,
          chromaHints,
        });

        const raw = await this.llm.invokeJson<unknown>(system, user, 45_000);
        const parsed = parseItineraryGenerationResponse(raw, activity.name);
        const factualOk =
          parsed &&
          validateItineraryAgainstFactualSchedule(
            parsed,
            promptPerformances,
            selectedDjIds,
          );
        if (factualOk && parsed) {
          itinerary = parsed;
          llmUsed = true;
        } else if (parsed) {
          this.logger.warn(
            'Itinerary LLM output failed factual validation; using rule-based fallback',
          );
        } else {
          this.logger.warn('Itinerary LLM parse failed; using rule-based fallback');
        }
      }

      const result: GenerateItineraryResult = {
        itinerary,
        conflicts,
        cached: false,
        llmUsed,
      };

      await this.cache.setGenerationCache(
        input.activityLegacyId,
        primaryDateKey,
        selectedDjIds,
        result,
      );

      await this.logModel.create({
        userId: input.userId,
        activityLegacyId: input.activityLegacyId,
        selectedDjIds,
        cached: false,
        llmUsed,
        meta: { conflictCount: conflicts.length, dateKey: primaryDateKey },
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
