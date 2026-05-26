import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { IUserRepository, UserRecord } from './interfaces/user.repository.interface';

const DEFAULT_PROFILE_EXTERNAL_ID = 'demo-zara';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
  ) {}

  async findDefaultProfile(): Promise<UserRecord | null> {
    return this.model.findOne({ externalId: DEFAULT_PROFILE_EXTERNAL_ID }).lean();
  }

  async findByExternalId(externalId: string): Promise<UserRecord | null> {
    return this.model.findOne({ externalId }).lean();
  }

  async upsertDefaultProfile(data: Partial<UserDocument>): Promise<UserRecord> {
    return this.model.findOneAndUpdate(
      { externalId: DEFAULT_PROFILE_EXTERNAL_ID },
      { ...data, externalId: DEFAULT_PROFILE_EXTERNAL_ID },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  async updateByExternalId(
    externalId: string,
    data: Partial<UserDocument>,
  ): Promise<UserRecord | null> {
    return this.model
      .findOneAndUpdate(
        { externalId },
        { $set: data },
        { new: true },
      )
      .lean();
  }

  async findByExternalIds(externalIds: string[]): Promise<UserRecord[]> {
    if (!externalIds.length) return [];
    return this.model
      .find({ externalId: { $in: externalIds } })
      .select('externalId privacyLevel')
      .lean();
  }
}

export { DEFAULT_PROFILE_EXTERNAL_ID };
