import { Injectable, Logger } from '@nestjs/common';
import {
  ChromaService,
  type ItineraryPerformanceRecord,
} from '../../ai/rag/chroma.service';
import type { ArtistPerformance } from '../../database/schemas/artist-performance.schema';

/**
 * Indexes official performance slots in Chroma for fast factual retrieval;
 * falls back to Mongo when Chroma is disabled or returns no rows.
 */
@Injectable()
export class ItineraryChromaService {
  private readonly logger = new Logger(ItineraryChromaService.name);

  constructor(private readonly chroma: ChromaService) {}

  performanceDocumentText(perf: ArtistPerformance): string {
    return [
      perf.artistName,
      perf.genreLabel,
      perf.stageLabel,
      perf.dateLabel,
      `${perf.startTime}-${perf.endTime}`,
    ].join(' · ');
  }

  private toRecord(perf: ArtistPerformance): ItineraryPerformanceRecord {
    return {
      activityLegacyId: perf.activityLegacyId,
      dateKey: perf.dateKey,
      dateLabel: perf.dateLabel,
      artistId: perf.artistId,
      artistName: perf.artistName,
      stage: perf.stage,
      stageLabel: perf.stageLabel,
      startTime: perf.startTime,
      endTime: perf.endTime,
      startMinutes: perf.startMinutes,
      endMinutes: perf.endMinutes,
      genre: perf.genre,
      genreLabel: perf.genreLabel,
    };
  }

  private recordToPerformance(
    record: ItineraryPerformanceRecord,
  ): ArtistPerformance {
    return {
      activityLegacyId: record.activityLegacyId,
      dateKey: record.dateKey,
      dateLabel: record.dateLabel,
      artistId: record.artistId,
      artistName: record.artistName,
      genre: record.genre,
      genreLabel: record.genreLabel,
      stage: record.stage,
      stageLabel: record.stageLabel,
      startTime: record.startTime,
      endTime: record.endTime,
      startMinutes: record.startMinutes,
      endMinutes: record.endMinutes,
      popularity: 0,
      avatarSeed: record.artistId,
      genreColor: '#ff2d55',
    };
  }

  async indexPerformances(performances: ArtistPerformance[]): Promise<void> {
    if (performances.length === 0) return;
    const records = performances.map(p => this.toRecord(p));
    await this.chroma.upsertItineraryPerformances(records);
    this.logger.debug(
      `Indexed ${records.length} itinerary performance(s) into Chroma`,
    );
  }

  /** Chroma filter by activity + artists; Mongo fallback when vector index unavailable. */
  async resolveFactualPerformances(input: {
    activityLegacyId: number;
    selectedDjIds: string[];
    mongoPerformances: ArtistPerformance[];
    dateKey?: string;
    primaryDateKey: string;
  }): Promise<{
    performances: ArtistPerformance[];
    chromaUsed: boolean;
    hints: string[];
  }> {
    const selected = new Set(input.selectedDjIds);
    const mongoFiltered = input.mongoPerformances
      .filter(
        p =>
          selected.has(p.artistId) &&
          (!input.dateKey ||
            p.dateKey === input.dateKey ||
            p.dateKey === input.primaryDateKey),
      )
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (!this.chroma.isEnabled()) {
      return {
        performances: mongoFiltered,
        chromaUsed: false,
        hints: mongoFiltered
          .slice(0, 12)
          .map(p => this.performanceDocumentText(p)),
      };
    }

    const chromaRecords = await this.chroma.getItineraryPerformances({
      activityLegacyId: input.activityLegacyId,
      artistIds: input.selectedDjIds,
      dateKey: input.dateKey,
    });

    const performances =
      chromaRecords.length > 0
        ? chromaRecords.map(r => this.recordToPerformance(r))
        : mongoFiltered;

    return {
      performances,
      chromaUsed: chromaRecords.length > 0,
      hints: performances
        .slice(0, 12)
        .map(p => this.performanceDocumentText(p)),
    };
  }

  queryHints(
    performances: ArtistPerformance[],
    selectedArtistIds: string[],
    limit = 12,
  ): string[] {
    const selected = new Set(selectedArtistIds);
    return performances
      .filter(p => selected.has(p.artistId))
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .slice(0, limit)
      .map(p => this.performanceDocumentText(p));
  }
}
