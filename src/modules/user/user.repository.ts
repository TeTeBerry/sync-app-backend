import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import {
  IUserRepository,
  UserRecord,
} from './interfaces/user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private readonly model: Model<UserDocument>,
  ) {}

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
      throw new Error(`Failed to upsert user: ${externalId}`);
    }
    return doc;
  }

  async findByExternalIds(externalIds: string[]): Promise<UserRecord[]> {
    if (!externalIds.length) return [];
    return this.model.find({ externalId: { $in: externalIds } }).lean();
  }

  async findSummariesByExternalIds(
    externalIds: string[],
  ): Promise<UserRecord[]> {
    if (!externalIds.length) return [];
    return this.model
      .find({ externalId: { $in: externalIds } })
      .select('externalId name handle avatar')
      .lean();
  }

  async getTokenVersion(externalId: string): Promise<number> {
    const doc = await this.model
      .findOne({ externalId })
      .select('tokenVersion')
      .lean();
    return doc?.tokenVersion ?? 0;
  }

  async incrementTokenVersion(externalId: string): Promise<number> {
    const doc = await this.model
      .findOneAndUpdate(
        { externalId },
        { $inc: { tokenVersion: 1 } },
        { new: true },
      )
      .select('tokenVersion')
      .lean();
    return doc?.tokenVersion ?? 1;
  }
}
