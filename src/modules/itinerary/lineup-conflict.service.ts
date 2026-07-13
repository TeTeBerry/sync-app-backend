import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ArtistPerformance,
  ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import {
  getArtistScheduleStatus,
  summarizeConflicts,
  toClashPerformances,
  computeScheduleVersion,
  conflictsInvolvingArtist,
  type ArtistScheduleStatus,
  type ClashPerformance,
  type ClashResolutionOption,
  type LineupConflict,
} from './domain/lineup-conflict.util';
import { isPublishedSchedulePerformance } from './domain/itinerary-catalog.util';
import { StageTransferService } from './stage-transfer.service';
import { ScheduleOverlapService } from './schedule-overlap.service';
import { ItineraryConflictService } from './itinerary-conflict.service';
import {
  dateKeysForTomorrowlandBelgiumWeekend,
  type TomorrowlandBelgiumWeekend,
} from './domain/tomorrowland-belgium-weekend.util';

export type ScheduleCompatibility = {
  status: ArtistScheduleStatus;
  conflictArtistIds: string[];
  summary?: string;
};

export type ArtistConflictEvaluation = {
  artistId: string;
  status: ArtistScheduleStatus;
  conflicts: LineupConflict[];
  resolutionOptions: ClashResolutionOption[];
  scheduleVersion: string;
  schedulePublished: boolean;
};

export type LineupConflictsPayload = {
  scheduleVersion: string;
  schedulePublished: boolean;
  computedAt: string;
  conflicts: LineupConflict[];
  summary: ReturnType<typeof summarizeConflicts>;
  staleResolutions?: string[];
};

@Injectable()
export class LineupConflictService {
  constructor(
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    private readonly stageTransfer: StageTransferService,
    private readonly scheduleOverlap: ScheduleOverlapService,
    private readonly legacyConflicts: ItineraryConflictService,
  ) {}

  /**
   * Legacy overlap-only detector — kept for itinerary schedule/generate compatibility.
   */
  detectLegacyConflicts(
    performances: ArtistPerformance[],
    selectedDjIds: string[],
  ) {
    return this.legacyConflicts.detectConflicts(performances, selectedDjIds);
  }

  async loadClashPerformances(
    eventId: number,
    options?: { weekend?: TomorrowlandBelgiumWeekend },
  ): Promise<{
    performances: ClashPerformance[];
    raw: ArtistPerformance[];
    schedulePublished: boolean;
    scheduleVersion: string;
  }> {
    const dateKeys = dateKeysForTomorrowlandBelgiumWeekend(
      eventId,
      options?.weekend,
    );
    const raw = await this.performanceModel
      .find({
        activityLegacyId: eventId,
        ...(dateKeys ? { dateKey: { $in: dateKeys } } : {}),
      })
      .lean();
    const published = raw.filter((row) =>
      isPublishedSchedulePerformance({
        startMinutes: row.startMinutes,
        startTime: row.startTime,
      }),
    );
    const schedulePublished = published.length > 0;
    const performances = toClashPerformances(
      (schedulePublished ? published : raw).map((row) => ({
        artistId: row.artistId,
        artistName: row.artistName,
        dateKey: row.dateKey,
        stage: row.stage,
        stageLabel: row.stageLabel,
        startTime: row.startTime,
        endTime: row.endTime,
        startMinutes: row.startMinutes,
        endMinutes: row.endMinutes,
      })),
    );
    return {
      performances,
      raw: raw as ArtistPerformance[],
      schedulePublished,
      scheduleVersion: computeScheduleVersion(performances, schedulePublished),
    };
  }

  private transferContext(eventId?: number): {
    stagePairMinutes?: Record<string, number>;
    defaultTransferMinutes?: number;
  } {
    if (eventId == null) return {};
    return {
      stagePairMinutes: this.stageTransfer.getStagePairs(eventId),
      defaultTransferMinutes: this.stageTransfer.getEventDefault(eventId),
    };
  }

  detectConflicts(input: {
    selectedArtistIds: string[];
    performances: ClashPerformance[];
    schedulePublished: boolean;
    deferredArtistIds?: string[];
    journeyArtistIds?: string[];
    eventId?: number;
  }): LineupConflict[] {
    const transfer = this.transferContext(input.eventId);
    return this.scheduleOverlap.detect({
      selectedArtistIds: input.selectedArtistIds,
      performances: input.performances,
      schedulePublished: input.schedulePublished,
      deferredArtistIds: input.deferredArtistIds,
      journeyArtistIds: input.journeyArtistIds,
      stagePairMinutes: transfer.stagePairMinutes,
      defaultTransferMinutes: transfer.defaultTransferMinutes,
    });
  }

  async getConflictsForLineup(input: {
    eventId: number;
    selectedArtistIds: string[];
    deferredArtistIds?: string[];
    journeyArtistIds?: string[];
    priorScheduleVersion?: string;
    priorResolutionConflictIds?: string[];
    weekend?: TomorrowlandBelgiumWeekend;
  }): Promise<LineupConflictsPayload> {
    const loaded = await this.loadClashPerformances(input.eventId, {
      weekend: input.weekend,
    });
    const conflicts = this.detectConflicts({
      eventId: input.eventId,
      selectedArtistIds: input.selectedArtistIds,
      performances: loaded.performances,
      schedulePublished: loaded.schedulePublished,
      deferredArtistIds: input.deferredArtistIds,
      journeyArtistIds: input.journeyArtistIds,
    });

    const staleResolutions =
      input.priorScheduleVersion &&
      input.priorScheduleVersion !== loaded.scheduleVersion
        ? (input.priorResolutionConflictIds ?? [])
        : undefined;

    return {
      scheduleVersion: loaded.scheduleVersion,
      schedulePublished: loaded.schedulePublished,
      computedAt: new Date().toISOString(),
      conflicts,
      summary: summarizeConflicts(conflicts),
      staleResolutions,
    };
  }

  async evaluateArtist(input: {
    eventId: number;
    artistId: string;
    selectedArtistIds: string[];
    deferredArtistIds?: string[];
    journeyArtistIds?: string[];
    weekend?: TomorrowlandBelgiumWeekend;
  }): Promise<ArtistConflictEvaluation> {
    const loaded = await this.loadClashPerformances(input.eventId, {
      weekend: input.weekend,
    });
    const transfer = this.transferContext(input.eventId);
    const probeIds = input.selectedArtistIds.includes(input.artistId)
      ? input.selectedArtistIds
      : [...input.selectedArtistIds, input.artistId];

    const conflicts = this.detectConflicts({
      eventId: input.eventId,
      selectedArtistIds: probeIds,
      performances: loaded.performances,
      schedulePublished: loaded.schedulePublished,
      deferredArtistIds: input.deferredArtistIds,
      journeyArtistIds: input.journeyArtistIds,
    }).filter(
      (conflict) =>
        conflict.artistAId === input.artistId ||
        conflict.artistBId === input.artistId,
    );

    const status = getArtistScheduleStatus({
      artistId: input.artistId,
      selectedArtistIds: input.selectedArtistIds,
      performances: loaded.performances,
      schedulePublished: loaded.schedulePublished,
      deferredArtistIds: input.deferredArtistIds,
      journeyArtistIds: input.journeyArtistIds,
      stagePairMinutes: transfer.stagePairMinutes,
      defaultTransferMinutes: transfer.defaultTransferMinutes,
    });

    const resolutionOptions = conflicts.flatMap((c) => c.resolutionOptions);

    return {
      artistId: input.artistId,
      status,
      conflicts,
      resolutionOptions,
      scheduleVersion: loaded.scheduleVersion,
      schedulePublished: loaded.schedulePublished,
    };
  }

  scheduleCompatibilityFor(
    artistId: string,
    selectedArtistIds: string[],
    performances: ClashPerformance[],
    schedulePublished: boolean,
    deferredArtistIds?: string[],
    journeyArtistIds?: string[],
    eventId?: number,
  ): ScheduleCompatibility {
    const transfer = this.transferContext(eventId);
    const status = getArtistScheduleStatus({
      artistId,
      selectedArtistIds,
      performances,
      schedulePublished,
      deferredArtistIds,
      journeyArtistIds,
      stagePairMinutes: transfer.stagePairMinutes,
      defaultTransferMinutes: transfer.defaultTransferMinutes,
    });
    const probeIds = selectedArtistIds.includes(artistId)
      ? selectedArtistIds
      : [...selectedArtistIds, artistId];
    const conflicts = this.scheduleOverlap.detect({
      selectedArtistIds: probeIds,
      performances,
      schedulePublished,
      deferredArtistIds,
      journeyArtistIds,
      stagePairMinutes: transfer.stagePairMinutes,
      defaultTransferMinutes: transfer.defaultTransferMinutes,
    });
    const involving = conflictsInvolvingArtist(conflicts, artistId);
    return {
      status,
      conflictArtistIds: [
        ...new Set(
          involving.flatMap((c) =>
            [c.artistAId, c.artistBId].filter((id) => id !== artistId),
          ),
        ),
      ],
      summary:
        status === 'fits-route'
          ? 'fits-route'
          : status === 'schedule-pending'
            ? 'schedule-pending'
            : status,
    };
  }

  /**
   * Prefer a route-compatible alternative among candidates.
   * Never treats schedule-pending as "compatible".
   */
  pickCompatibleAlternative(input: {
    candidates: string[];
    excludeArtistId: string;
    selectedArtistIds: string[];
    performances: ClashPerformance[];
    schedulePublished: boolean;
    eventId?: number;
  }): string | undefined {
    const transfer = this.transferContext(input.eventId);
    for (const candidate of input.candidates) {
      if (candidate === input.excludeArtistId) continue;
      const status = getArtistScheduleStatus({
        artistId: candidate,
        selectedArtistIds: input.selectedArtistIds,
        performances: input.performances,
        schedulePublished: input.schedulePublished,
        stagePairMinutes: transfer.stagePairMinutes,
        defaultTransferMinutes: transfer.defaultTransferMinutes,
      });
      if (status === 'fits-route') {
        return candidate;
      }
    }
    return undefined;
  }

  transferEstimate(eventId: number, stageA: string, stageB: string) {
    return this.stageTransfer.estimate(eventId, stageA, stageB);
  }
}
