import type { Activity } from '../../../database/schemas/activity.schema';

export type ActivityLookupRecord = Activity & { _id?: unknown };

export interface IActivityLookupPort {
  findAll(): Promise<ActivityLookupRecord[]>;
  findByLegacyId(legacyId: number): Promise<ActivityLookupRecord | null>;
}

export const ACTIVITY_LOOKUP_PORT = Symbol('ACTIVITY_LOOKUP_PORT');
