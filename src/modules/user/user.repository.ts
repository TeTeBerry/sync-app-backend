import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import {
  IUserRepository,
  UserRecord,
} from './interfaces/user.repository.interface';

const DEFAULT_PROFILE_EXTERNAL_ID = 'demo-zara';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
  ) {}

  async findDefaultProfile(): Promise<UserRecord | null> {
    return this.model
      .findOne({ externalId: DEFAULT_PROFILE_EXTERNAL_ID })
      .lean();
  }

  async findByExternalId(externalId: string): Promise<UserRecord | null> {
    return this.model.findOne({ externalId }).lean();
  }

  async findByOpenid(openid: string): Promise<UserRecord | null> {
    return this.model.findOne({ openid }).lean();
  }

  async upsertWechatUser(
    openid: string,
    data: Partial<UserDocument> & { unionid?: string },
  ): Promise<UserRecord> {
    const externalId = `wx_${openid}`;
    const doc = await this.model
      .findOneAndUpdate(
        { openid },
        {
          $set: {
            ...data,
            openid,
            externalId,
            unionid: data.unionid,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    if (!doc) {
      throw new Error(`Failed to upsert WeChat user: ${openid}`);
    }
    return doc;
  }

  async upsertDefaultProfile(data: Partial<UserDocument>): Promise<UserRecord> {
    return this.model
      .findOneAndUpdate(
        { externalId: DEFAULT_PROFILE_EXTERNAL_ID },
        { ...data, externalId: DEFAULT_PROFILE_EXTERNAL_ID },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
  }

  async updateByExternalId(
    externalId: string,
    data: Partial<UserDocument>,
  ): Promise<UserRecord | null> {
    return this.model
      .findOneAndUpdate({ externalId }, { $set: data }, { new: true })
      .lean();
  }

  async upsertByExternalId(
    externalId: string,
    data: Partial<UserDocument>,
  ): Promise<UserRecord> {
    const doc = await this.model
      .findOneAndUpdate(
        { externalId },
        { $set: { ...data, externalId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    if (!doc) {
      throw new Error(`Failed to upsert user profile: ${externalId}`);
    }
    return doc;
  }

  async findByExternalIds(externalIds: string[]): Promise<UserRecord[]> {
    if (!externalIds.length) return [];
    return this.model
      .find({ externalId: { $in: externalIds } })
      .select('externalId privacyLevel')
      .lean();
  }

  async findSummariesByExternalIds(externalIds: string[]): Promise<UserRecord[]> {
    if (!externalIds.length) return [];
    return this.model
      .find({ externalId: { $in: externalIds } })
      .select('externalId name avatar handle')
      .lean();
  }
}

export { DEFAULT_PROFILE_EXTERNAL_ID };
