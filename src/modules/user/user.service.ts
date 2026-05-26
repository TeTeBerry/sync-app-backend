import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from './interfaces/user.repository.interface';
import { DEFAULT_PROFILE_EXTERNAL_ID } from './user.repository';

const DEMO_PROFILE = {
  externalId: DEFAULT_PROFILE_EXTERNAL_ID,
  name: 'Zara Chen',
  handle: '@zara',
  location: '上海',
  bio: '电音爱好者',
  avatar:
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  city: '上海',
  favorGenres: ['EDM', 'Techno'],
  budgetLevel: 'medium',
  likeMate: true,
};

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: IUserRepository,
  ) {}

  async onModuleInit() {
    await this.repository.upsertDefaultProfile(DEMO_PROFILE);
  }

  ping() {
    return { ok: true, scope: 'user' };
  }

  getDefaultProfile() {
    return this.repository.findDefaultProfile();
  }

  resolveProfile(userId?: string, authorName?: string) {
    const uid = userId?.trim();
    if (uid) {
      return this.repository.findByExternalId(uid);
    }
    void authorName;
    return this.repository.findDefaultProfile();
  }
}
