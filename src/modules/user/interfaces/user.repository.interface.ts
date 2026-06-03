import { UserDocument } from '../../../database/schemas/user.schema';

export interface UserQueryFilter {
  externalId?: string;
  authorName?: string;
}

export type UserRecord = Partial<UserDocument> & {
  name?: string;
  handle?: string;
  location?: string;
  bio?: string;
  avatar?: string;
};

export interface IUserRepository {
  findDefaultProfile(): Promise<UserRecord | null>;
  findByOpenid(openid: string): Promise<UserRecord | null>;
  findByExternalId(externalId: string): Promise<UserRecord | null>;
  upsertWechatUser(
    openid: string,
    data: Partial<UserDocument> & { unionid?: string },
  ): Promise<UserRecord>;
  upsertDefaultProfile(data: Partial<UserDocument>): Promise<UserRecord>;
  updateByExternalId(
    externalId: string,
    data: Partial<UserDocument>,
  ): Promise<UserRecord | null>;
  upsertByExternalId(
    externalId: string,
    data: Partial<UserDocument>,
  ): Promise<UserRecord>;
  findByExternalIds(externalIds: string[]): Promise<UserRecord[]>;
  findSummariesByExternalIds(externalIds: string[]): Promise<UserRecord[]>;
  getTokenVersion(externalId: string): Promise<number>;
  incrementTokenVersion(externalId: string): Promise<number>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
