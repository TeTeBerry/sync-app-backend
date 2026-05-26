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
  findByExternalId(externalId: string): Promise<UserRecord | null>;
  upsertDefaultProfile(data: Partial<UserDocument>): Promise<UserRecord>;
  updateByExternalId(
    externalId: string,
    data: Partial<UserDocument>,
  ): Promise<UserRecord | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
