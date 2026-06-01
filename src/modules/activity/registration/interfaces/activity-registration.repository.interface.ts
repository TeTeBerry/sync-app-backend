import { ActivityRegistrationDocument } from '../../../../database/schemas/activity-registration.schema';

export interface ActivityRegistrationQueryFilter {
  userId?: string;
  authorName?: string;
}

export type ActivityRegistrationRecord = ActivityRegistrationDocument & {
  _id: unknown;
};

export interface CreateActivityRegistrationInput {
  userId: string;
  authorName?: string;
  activityLegacyId: number;
  status: 'registered';
}

export interface IActivityRegistrationRepository {
  findByOwner(
    filter: ActivityRegistrationQueryFilter,
  ): Promise<ActivityRegistrationRecord[]>;
  countByOwner(filter: ActivityRegistrationQueryFilter): Promise<number>;
  findByOwnerAndActivity(
    filter: ActivityRegistrationQueryFilter,
    activityLegacyId: number,
  ): Promise<ActivityRegistrationRecord | null>;
  create(
    input: CreateActivityRegistrationInput,
  ): Promise<ActivityRegistrationRecord>;
  deleteByOwnerAndActivity(
    filter: ActivityRegistrationQueryFilter,
    activityLegacyId: number,
  ): Promise<boolean>;
  findRegisteredUserIds(activityLegacyId: number): Promise<string[]>;
}

export const ACTIVITY_REGISTRATION_REPOSITORY = Symbol(
  'ACTIVITY_REGISTRATION_REPOSITORY',
);
