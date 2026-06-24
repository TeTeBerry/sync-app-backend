import { ActivitySetVoteDocument } from '../../../../database/schemas/activity-set-vote.schema';

export type ActivitySetVoteRecord = ActivitySetVoteDocument & {
  _id: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface UpsertSetVoteInput {
  userId: string;
  activityLegacyId: number;
  picks: string[];
}

export interface SetVoteLeaderboardRow {
  artistId: string;
  voteCount: number;
}

export interface ISetVoteRepository {
  findByUserAndActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<ActivitySetVoteRecord | null>;
  upsert(input: UpsertSetVoteInput): Promise<ActivitySetVoteRecord>;
  countVoters(activityLegacyId: number): Promise<number>;
  aggregateLeaderboard(
    activityLegacyId: number,
    limit: number,
  ): Promise<SetVoteLeaderboardRow[]>;
}

export const SET_VOTE_REPOSITORY = Symbol('SET_VOTE_REPOSITORY');
