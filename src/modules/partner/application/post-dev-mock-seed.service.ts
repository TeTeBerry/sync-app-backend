import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../../../database/schemas/post.schema';
import {
  buildDevMockTmlBuddyPosts,
  DEV_MOCK_TML_POST_USER_PREFIX,
  TML_THAILAND_LEGACY_ID,
} from '../data/dev-mock-buddy-posts.util';

/** Dev-only mock buddy posts for Tomorrowland Thailand (activity legacyId 1). */
@Injectable()
export class PostDevMockSeedService implements OnModuleInit {
  private readonly logger = new Logger(PostDevMockSeedService.name);

  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    if (process.env.DISABLE_DEV_MOCK_POSTS === 'true') {
      return;
    }

    try {
      await this.seedTmlMockPosts();
    } catch (error) {
      this.logger.warn(
        `Dev mock post seed failed: ${(error as Error).message}`,
      );
    }
  }

  private async seedTmlMockPosts(): Promise<void> {
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

    const total = await this.postModel.countDocuments({
      activityLegacyId: TML_THAILAND_LEGACY_ID,
      userId: { $regex: `^${DEV_MOCK_TML_POST_USER_PREFIX}` },
    });

    this.logger.log(
      `Dev mock buddy posts for TML Thailand: upserted ${upserted}, total mock rows ${total}`,
    );
  }
}
