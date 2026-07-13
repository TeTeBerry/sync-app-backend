import { Injectable } from '@nestjs/common';
import {
  detectLineupConflicts,
  type ClashPerformance,
  type LineupConflict,
} from './domain/lineup-conflict.util';

/**
 * Shared schedule overlap / clash classification.
 * Consumed by LineupConflictService — do not reimplement overlap math elsewhere.
 */
@Injectable()
export class ScheduleOverlapService {
  detect(input: {
    selectedArtistIds: string[];
    performances: ClashPerformance[];
    schedulePublished: boolean;
    deferredArtistIds?: string[];
    journeyArtistIds?: string[];
    stagePairMinutes?: Record<string, number>;
    defaultTransferMinutes?: number;
  }): LineupConflict[] {
    return detectLineupConflicts(input);
  }
}
