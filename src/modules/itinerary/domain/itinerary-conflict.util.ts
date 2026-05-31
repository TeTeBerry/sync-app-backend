import {
  formatMinutesAsTime,
  overlapWindow,
  rangesOverlap,
} from './time-minutes.util';

export interface PerformanceSlot {
  artistId: string;
  artistName: string;
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  stageLabel: string;
}

export interface ItineraryConflict {
  artistIds: [string, string];
  artistNames: [string, string];
  dateKey: string;
  overlapStart: string;
  overlapEnd: string;
  message: string;
}

function conflictPairKey(a: string, b: string, dateKey: string): string {
  const sorted = [a, b].sort();
  return `${dateKey}:${sorted[0]}:${sorted[1]}`;
}

/** Detect overlapping performances among selected artist IDs (non-blocking warnings). */
export function detectPerformanceConflicts(
  performances: PerformanceSlot[],
  selectedArtistIds: string[],
): ItineraryConflict[] {
  const selected = new Set(selectedArtistIds);
  const byDate = new Map<string, PerformanceSlot[]>();

  for (const perf of performances) {
    if (!selected.has(perf.artistId)) continue;
    const list = byDate.get(perf.dateKey) ?? [];
    list.push(perf);
    byDate.set(perf.dateKey, list);
  }

  const conflicts: ItineraryConflict[] = [];
  const seen = new Set<string>();

  for (const [dateKey, slots] of byDate) {
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const a = slots[i];
        const b = slots[j];
        if (!rangesOverlap(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes)) {
          continue;
        }
        const key = conflictPairKey(a.artistId, b.artistId, dateKey);
        if (seen.has(key)) continue;
        seen.add(key);

        const window = overlapWindow(
          a.startMinutes,
          a.endMinutes,
          b.startMinutes,
          b.endMinutes,
        );
        const overlapStart = window
          ? formatMinutesAsTime(window.start)
          : a.startTime;
        const overlapEnd = window ? formatMinutesAsTime(window.end) : a.endTime;

        conflicts.push({
          artistIds: [a.artistId, b.artistId],
          artistNames: [a.artistName, b.artistName],
          dateKey,
          overlapStart,
          overlapEnd,
          message: `${a.artistName}（${a.stageLabel} ${a.startTime}-${a.endTime}）与 ${b.artistName}（${b.stageLabel} ${b.startTime}-${b.endTime}）在 ${overlapStart}-${overlapEnd} 时段重叠，建议提前规划转场路线。`,
        });
      }
    }
  }

  return conflicts;
}
