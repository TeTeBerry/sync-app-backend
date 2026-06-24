import {
  extractYearFromText,
  getActivitySortTimestamp,
  isActivityEnded,
} from '../../../common/utils/activity-date.util';
import type { IActivityLookupPort } from '../../activity/ports/activity-lookup.port';
import type { ItineraryScheduleService } from '../../itinerary/itinerary-schedule.service';
import type {
  PersonalityEventRecommendation,
  RecommendDjLineupResult,
} from '../personality-test.types';

type DjMatchWeight = {
  name: string;
  weight: number;
};

type ActivityAccumulator = {
  activityLegacyId: number;
  name: string;
  dateLabel: string;
  location?: string;
  matchedDjs: Set<string>;
  weightedScore: number;
  hasSoulDj: boolean;
};

function collectDjMatchers(
  recommendations: RecommendDjLineupResult,
): DjMatchWeight[] {
  const byName = new Map<string, number>();

  const add = (name: string, weight: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    byName.set(trimmed, Math.max(byName.get(trimmed) ?? 0, weight));
  };

  add(recommendations.soulMatch.djName, 100);
  for (const item of recommendations.mustSee) {
    add(item.djName, 70);
  }
  for (const item of recommendations.recommended) {
    add(item.djName, 40);
  }

  return [...byName.entries()].map(([name, weight]) => ({ name, weight }));
}

function sortMatchedDjNames(
  names: string[],
  matchers: DjMatchWeight[],
): string[] {
  const weightByName = new Map(
    matchers.map((item) => [item.name, item.weight]),
  );
  return [...names].sort((a, b) => {
    const weightDiff = (weightByName.get(b) ?? 0) - (weightByName.get(a) ?? 0);
    if (weightDiff !== 0) return weightDiff;
    return a.localeCompare(b, 'zh-CN');
  });
}

function isUpcomingActivity(name: string, dateLabel: string): boolean {
  const yearHint = extractYearFromText(name) ?? extractYearFromText(dateLabel);
  return !isActivityEnded(dateLabel, { yearHint });
}

function hitKey(hit: { activityLegacyId: number; artistName: string }): string {
  return `${hit.activityLegacyId}:${hit.artistName.trim().toLowerCase()}`;
}

function mergeArtistHits<
  T extends { activityLegacyId: number; artistName: string },
>(...groups: T[][]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const group of groups) {
    for (const hit of group) {
      const key = hitKey(hit);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }
  return merged;
}

export async function recommendEventsForPersonality(
  recommendations: RecommendDjLineupResult,
  activityLookup: IActivityLookupPort,
  scheduleService: ItineraryScheduleService,
): Promise<PersonalityEventRecommendation[]> {
  const djMatchers = collectDjMatchers(recommendations);
  const soulName = recommendations.soulMatch.djName.trim();
  const accumulators = new Map<number, ActivityAccumulator>();

  for (const matcher of djMatchers) {
    const performanceHits = await scheduleService.findArtistPerformances({
      artistName: matcher.name,
    });
    const lineupHits = await scheduleService.findArtistLineupMemberships({
      artistName: matcher.name,
    });
    const hits = mergeArtistHits(performanceHits, lineupHits);
    for (const hit of hits) {
      const existing = accumulators.get(hit.activityLegacyId);
      if (existing) {
        existing.matchedDjs.add(hit.artistName);
        existing.weightedScore += matcher.weight;
        if (matcher.name === soulName) {
          existing.hasSoulDj = true;
        }
        continue;
      }
      accumulators.set(hit.activityLegacyId, {
        activityLegacyId: hit.activityLegacyId,
        name: hit.activityName,
        dateLabel: hit.dateLabel,
        matchedDjs: new Set([hit.artistName]),
        weightedScore: matcher.weight,
        hasSoulDj: matcher.name === soulName,
      });
    }
  }

  if (!accumulators.size) {
    return [];
  }

  const activities = await activityLookup.findAllBasics();
  const activityById = new Map(
    activities.map((activity) => [activity.legacyId, activity]),
  );

  for (const entry of accumulators.values()) {
    const activity = activityById.get(entry.activityLegacyId);
    if (!activity) {
      continue;
    }
    entry.name = activity.name?.trim() || entry.name;
    entry.dateLabel = activity.date?.trim() || entry.dateLabel;
    entry.location = activity.location?.trim() || entry.location;
  }

  return [...accumulators.values()]
    .filter((item) => item.matchedDjs.size > 0)
    .filter((item) => isUpcomingActivity(item.name, item.dateLabel))
    .sort((a, b) => {
      if (b.weightedScore !== a.weightedScore) {
        return b.weightedScore - a.weightedScore;
      }
      if (a.hasSoulDj !== b.hasSoulDj) {
        return a.hasSoulDj ? -1 : 1;
      }
      if (b.matchedDjs.size !== a.matchedDjs.size) {
        return b.matchedDjs.size - a.matchedDjs.size;
      }
      return (
        getActivitySortTimestamp(a.dateLabel, a.name) -
        getActivitySortTimestamp(b.dateLabel, b.name)
      );
    })
    .slice(0, 5)
    .map((item) => {
      const matched = sortMatchedDjNames([...item.matchedDjs], djMatchers);
      return {
        activityLegacyId: item.activityLegacyId,
        name: item.name,
        dateLabel: item.dateLabel,
        location: item.location,
        matchScore: Math.min(99, item.weightedScore),
        matchedDjs: matched,
        reason: `阵容含 ${matched.slice(0, 3).join('、')}${matched.length > 3 ? ' 等' : ''}`,
      };
    });
}
