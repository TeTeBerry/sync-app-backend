import { Injectable } from '@nestjs/common';
import {
  DEFAULT_CROSS_STAGE_TRANSFER_MINUTES,
  SAME_STAGE_TRANSFER_MINUTES,
  estimateTransferMinutes,
} from './domain/lineup-conflict.util';

/**
 * Stage walking / transfer estimates.
 * Supports event-level defaults and optional stage-pair overrides.
 * Never assumes zero transfer between different stages.
 */
@Injectable()
export class StageTransferService {
  private readonly eventDefaults = new Map<number, number>();
  private readonly stagePairs = new Map<number, Record<string, number>>();

  setEventDefaultTransfer(eventId: number, minutes: number): void {
    this.eventDefaults.set(eventId, Math.max(1, minutes));
  }

  setStagePairMinutes(eventId: number, pairs: Record<string, number>): void {
    this.stagePairs.set(eventId, pairs);
  }

  getStagePairs(eventId: number): Record<string, number> | undefined {
    return this.stagePairs.get(eventId);
  }

  getEventDefault(eventId: number): number | undefined {
    return this.eventDefaults.get(eventId);
  }

  estimate(
    eventId: number,
    stageA: string,
    stageB: string,
  ): { minutes: number; confidence: 'exact' | 'default' | 'unknown-stage' } {
    const left = stageA.trim();
    const right = stageB.trim();
    if (!left || !right) {
      return {
        minutes:
          this.eventDefaults.get(eventId) ??
          DEFAULT_CROSS_STAGE_TRANSFER_MINUTES,
        confidence: 'unknown-stage',
      };
    }
    if (left.toLowerCase() === right.toLowerCase()) {
      return { minutes: SAME_STAGE_TRANSFER_MINUTES, confidence: 'exact' };
    }
    const pairs = this.stagePairs.get(eventId);
    const estimated = estimateTransferMinutes(left, right, pairs);
    if (pairs) {
      const key = `${left.toLowerCase()}->${right.toLowerCase()}`;
      const reverse = `${right.toLowerCase()}->${left.toLowerCase()}`;
      if (pairs[key] != null || pairs[reverse] != null) {
        return { minutes: estimated, confidence: 'exact' };
      }
    }
    const eventDefault = this.eventDefaults.get(eventId);
    if (eventDefault != null) {
      return { minutes: eventDefault, confidence: 'default' };
    }
    return { minutes: estimated, confidence: 'default' };
  }
}
