import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../../../database/schemas/post.schema';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../../activity/ports/activity-lookup.port';
import {
  buildDevMockTmlBuddyPosts,
  DEV_MOCK_TML_POST_COUNT,
  DEV_MOCK_TML_POST_USER_PREFIX,
  TML_THAILAND_LEGACY_ID,
} from '../data/dev-mock-buddy-posts.util';

/** Dev-only mock buddy posts for Tomorrowland Thailand (activity legacyId 1). @see sync-app/docs/POST-LIFECYCLE.md § Dev mock 组队帖 */
@Injectable()
export class PostDevMockSeedService implements OnModuleInit {
  private readonly logger = new Logger(PostDevMockSeedService.name);

  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isDevMockEnabled()) {
      return;
    }

    try {
      await this.ensureTmlMockPosts();
    } catch (error) {
      this.logger.warn(
        `Dev mock post seed failed: ${(error as Error).message}`,
      );
    }
  }

  /** Re-upsert TML mock posts when dev DB was wiped without restarting the backend. */
  async ensureTmlMockPostsIfMissing(): Promise<void> {
    if (!this.isDevMockEnabled()) {
      return;
    }

    const total = await this.countTmlMockPosts();
    if (total >= DEV_MOCK_TML_POST_COUNT) {
      return;
    }

    await this.ensureTmlMockPosts();
  }

  private isDevMockEnabled(): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      process.env.DISABLE_DEV_MOCK_POSTS !== 'true'
    );
  }

  private async countTmlMockPosts(): Promise<number> {
    return this.postModel.countDocuments({
      activityLegacyId: TML_THAILAND_LEGACY_ID,
      userId: { $regex: `^${DEV_MOCK_TML_POST_USER_PREFIX}` },
    });
  }

  private async ensureTmlMockPosts(): Promise<void> {
    const seeds = buildDevMockTmlBuddyPosts();
    let upserted = 0;

    for (const seed of seeds) {
      const result = await this.postModel.findOneAndUpdate(
        {
          userId: seed.userId,
          activityLegacyId: seed.activityLegacyId,
        },
        { $set: seed },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (result) {
        upserted += 1;
      }
    }

    const total = await this.countTmlMockPosts();

    this.logger.log(
      `Dev mock buddy posts for TML Thailand: upserted ${upserted}, total mock rows ${total}`,
    );
    void this.activityLookup.refreshCache().catch(() => undefined);
  }
}
