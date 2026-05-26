import { ActivityRegistrationDocument } from '../../../database/schemas/activity-registration.schema';

export interface ActivityRegistrationQueryFilter {
  userId?: string;
  authorName?: string;
}

export type ActivityRegistrationRecord = ActivityRegistrationDocument & {
  _id: unknown;
};

export interface IActivityRegistrationRepository {
  findByOwner(
    filter: ActivityRegistrationQueryFilter,
  ): Promise<ActivityRegistrationRecord[]>;
  countByOwner(filter: ActivityRegistrationQueryFilter): Promise<number>;
  countCompletedPinsByOwner(
    filter: ActivityRegistrationQueryFilter,
  ): Promise<number>;
}

export const ACTIVITY_REGISTRATION_REPOSITORY = Symbol(
  'ACTIVITY_REGISTRATION_REPOSITORY',
);
