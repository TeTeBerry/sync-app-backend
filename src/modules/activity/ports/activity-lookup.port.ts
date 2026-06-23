import type { Activity } from '../../../database/schemas/activity.schema';

export type ActivityLookupRecord = Activity & {
  _id?: unknown;
  /** Lineup announced (performances or seeded lineup DJs). */
  lineupPublished?: boolean;
  /** Public recruit posts visible on activity feed. */
  recruitPostCount?: number;
  /** Whether AI travel guide generation is supported for this activity. */
  travelGuideSupported?: boolean;
};

export interface ActivityListPage {
  items: ActivityLookupRecord[];
  total: number;
  skip: number;
  limit: number;
}

export interface ActivityLookupPageOptions {
  skip?: number;
  limit?: number;
}

export interface IActivityLookupPort {
  findAll(): Promise<ActivityLookupRecord[]>;
  findByLegacyId(legacyId: number): Promise<ActivityLookupRecord | null>;
  findByLegacyIds(
    legacyIds: number[],
  ): Promise<Map<number, ActivityLookupRecord>>;
  findByCode(code: string): Promise<ActivityLookupRecord | null>;
  findPage(options?: ActivityLookupPageOptions): Promise<ActivityListPage>;
  refreshCache(): Promise<void>;
}

export const ACTIVITY_LOOKUP_PORT = Symbol('ACTIVITY_LOOKUP_PORT');
