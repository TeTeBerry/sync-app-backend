import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivitySetVote,
  ActivitySetVoteDocument,
} from '../../../database/schemas/activity-set-vote.schema';
import {
  ActivitySetVoteRecord,
  ISetVoteRepository,
  SetVoteLeaderboardRow,
  UpsertSetVoteInput,
} from './interfaces/set-vote.repository.interface';

@Injectable()
export class SetVoteRepository implements ISetVoteRepository {
  constructor(
    @InjectModel(ActivitySetVote.name)
    private readonly model: Model<ActivitySetVoteDocument>,
  ) {}

  async findByUserAndActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<ActivitySetVoteRecord | null> {
    return this.model.findOne({ userId, activityLegacyId }).lean();
  }

  async upsert(input: UpsertSetVoteInput): Promise<ActivitySetVoteRecord> {
    const updated = await this.model
      .findOneAndUpdate(
        { userId: input.userId, activityLegacyId: input.activityLegacyId },
        { $set: { picks: input.picks } },
        { upsert: true, new: true },
      )
      .lean();
    return updated as ActivitySetVoteRecord;
  }

  async countVoters(activityLegacyId: number): Promise<number> {
    return this.model.countDocuments({ activityLegacyId });
  }

  async aggregateLeaderboard(
    activityLegacyId: number,
    limit: number,
  ): Promise<SetVoteLeaderboardRow[]> {
    const rows = await this.model.aggregate<SetVoteLeaderboardRow>([
      { $match: { activityLegacyId } },
      { $unwind: '$picks' },
      {
        $group: {
          _id: '$picks',
          voteCount: { $sum: 1 },
        },
      },
      { $sort: { voteCount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          artistId: '$_id',
          voteCount: 1,
        },
      },
    ]);
    return rows;
  }
}
