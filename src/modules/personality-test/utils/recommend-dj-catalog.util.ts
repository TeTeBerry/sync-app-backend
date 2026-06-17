import type { PersonalityTypeMeta } from '../data/personality-types';
import type { PersonalityTestRuntimeCatalog } from '../personality-test-catalog.types';
import { DjService } from '../../dj/dj.service';
import type { ItineraryScheduleService } from '../../itinerary/itinerary-schedule.service';
import { PERSONALITY_TYPE_META } from '../data/personality-types';
import type {
  PersonalityScoreResult,
  RecommendDjLineupResult,
} from '../personality-test.types';
import {
  buildUpcomingLineupDjPool,
  LINEUP_POOL_EMPTY,
} from './lineup-dj-pool.util';
import { recommendDjLineup } from './recommend-dj-lineup.util';

export { LINEUP_POOL_EMPTY };

export async function recommendDjLineupFromCatalog(
  score: PersonalityScoreResult,
  djService: DjService,
  activityLegacyIds: number[],
  runtimeCatalog?: Pick<
    PersonalityTestRuntimeCatalog,
    'typeMeta' | 'soulProfiles'
  >,
  scheduleService?: Pick<
    ItineraryScheduleService,
    'listLineupArtistsForActivities'
  >,
): Promise<RecommendDjLineupResult> {
  const typeMeta = runtimeCatalog?.typeMeta ?? PERSONALITY_TYPE_META;
  const soulProfiles = runtimeCatalog?.soulProfiles;

  if (!scheduleService) {
    throw new Error(LINEUP_POOL_EMPTY);
  }

  const lineup = await buildUpcomingLineupDjPool(
    activityLegacyIds,
    scheduleService,
    djService,
  );
  if (!lineup.length) {
    throw new Error(LINEUP_POOL_EMPTY);
  }

  return recommendDjLineup(score, lineup, {
    typeMeta,
    soulProfiles,
  });
}
