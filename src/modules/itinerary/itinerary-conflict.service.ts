import { Injectable } from '@nestjs/common';
import type { ArtistPerformance } from '../../database/schemas/artist-performance.schema';
import {
  detectPerformanceConflicts,
  type ItineraryConflict,
  type PerformanceSlot,
} from './domain/itinerary-conflict.util';

@Injectable()
export class ItineraryConflictService {
  detectConflicts(
    performances: ArtistPerformance[],
    selectedDjIds: string[],
  ): ItineraryConflict[] {
    return detectPerformanceConflicts(
      this.toPerformanceSlots(performances),
      selectedDjIds,
    );
  }

  private toPerformanceSlots(
    performances: ArtistPerformance[],
  ): PerformanceSlot[] {
    return performances.map((p) => ({
      artistId: p.artistId,
      artistName: p.artistName,
      dateKey: p.dateKey,
      startMinutes: p.startMinutes,
      endMinutes: p.endMinutes,
      startTime: p.startTime,
      endTime: p.endTime,
      stageLabel: p.stageLabel,
    }));
  }
}
