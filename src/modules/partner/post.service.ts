import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { isPostOwnedByActor } from '../../common/auth/actor-query.util';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { UserService } from '../user/user.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdatePostRecruitDto } from './dto/update-post-recruit.dto';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from './interfaces/post.repository.interface';
import { PostWriteService } from './application/post-write.service';
import { PostQueryService } from './application/post-query.service';
import { PostCommentService } from './application/post-comment.service';
import { PostSearchService } from './application/post-search.service';
import { PostDevMockSeedService } from './application/post-dev-mock-seed.service';
import { TML_THAILAND_LEGACY_ID } from './data/dev-mock-buddy-posts.util';

@Injectable()
export class PostService implements OnModuleInit {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly postWrite: PostWriteService,
    private readonly postQuery: PostQueryService,
    private readonly postComments: PostCommentService,
    private readonly postSearch: PostSearchService,
    private readonly userService: UserService,
    private readonly devMockSeed: PostDevMockSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.migrateLegacyPostStatus();
    } catch (error) {
      this.logger.warn(
        `Legacy post status migration failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.migrateRemoveLegacyPostCounters();
    } catch (error) {
      this.logger.warn(
        `Legacy post counter migration failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.purgeLegacyCollections();
    } catch (error) {
      this.logger.warn(
        `Legacy collection cleanup failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.purgePostsForRemovedActivities();
    } catch (error) {
      this.logger.warn(
        `Expired activity post cleanup failed: ${(error as Error).message}`,
      );
    }
  }

  listPopular(limit = 20, actor: RequestActor) {
    return this.postQuery.listPopular(limit, actor);
  }

  async listByActivityPage(
    activityLegacyId: number,
    options: {
      limit?: number;
      cursor?: string;
      anchorPostId?: string;
    },
    actor: RequestActor,
  ) {
    if (activityLegacyId === TML_THAILAND_LEGACY_ID) {
      await this.devMockSeed.ensureTmlMockPostsIfMissing();
    }
    return this.postQuery.listByActivityPage(activityLegacyId, options, actor);
  }

  listByOwner(actor: RequestActor) {
    return this.postQuery.listByOwner(actor);
  }

  searchPostsByNaturalLanguage(
    query: string,
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    return this.postSearch.searchByNaturalLanguage(
      query,
      activityLegacyId,
      actor,
    );
  }

  createPost(
    dto: CreatePostDto,
    actor: RequestActor,
    options?: { skipRiskCheck?: boolean },
  ) {
    return this.postWrite.createPost(dto, actor, options);
  }

  updatePostRecruit(
    id: string,
    dto: UpdatePostRecruitDto,
    actor: RequestActor,
  ) {
    return this.postWrite.updateRecruitStatus(id, dto, actor);
  }

  updatePost(id: string, dto: UpdatePostDto, actor: RequestActor) {
    return this.postWrite.updatePost(id, dto, actor);
  }

  findPostById(id: string): Promise<PostRecord | null> {
    return this.postQuery.findPostById(id);
  }

  findOwnerActivePostForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    return this.postQuery.findOwnerActivePostForActivity(
      activityLegacyId,
      actor,
    );
  }

  async deleteOwnedPost(id: string, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (!(await this.isOwnedPost(post, actor))) {
      throw new ForbiddenException('无权删除该帖子');
    }

    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('帖子不存在');
    }
    await this.postComments.deleteCommentsForPost(id);
    return { ok: true as const };
  }

  listComments(id: string, options?: { limit?: number; cursor?: string }) {
    return this.postComments.listComments(id, options);
  }

  addComment(
    id: string,
    body: string,
    actor: RequestActor,
    parentCommentId?: string,
  ) {
    return this.postComments.addComment(id, body, actor, parentCommentId);
  }

  deleteOwnedComment(postId: string, commentId: string, actor: RequestActor) {
    return this.postComments.deleteOwnedComment(postId, commentId, actor);
  }

  private async isOwnedPost(
    post: { userId?: string; authorName?: string },
    actor: RequestActor,
  ): Promise<boolean> {
    const profile = await this.userService.resolveProfile(actor);
    return isPostOwnedByActor(post, actor, profile?.name);
  }

  /** Legacy completed/recruiting posts are normalized to active. */
  private async migrateLegacyPostStatus(): Promise<void> {
    const completed = await this.postModel.updateMany(
      { status: 'completed' },
      { $set: { status: 'active' } },
    );
    const recruiting = await this.postModel.updateMany(
      { status: 'recruiting' },
      { $set: { status: 'active' } },
    );
    const migrated =
      (completed.modifiedCount ?? 0) + (recruiting.modifiedCount ?? 0);
    if (migrated > 0) {
      this.logger.log(`Migrated ${migrated} legacy post statuses to active`);
    }
  }

  private async migrateRemoveLegacyPostCounters(): Promise<void> {
    const result = await this.postModel.updateMany(
      { likes: { $exists: true } },
      { $unset: { likes: '' } },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(
        `Removed likes from ${result.modifiedCount} legacy posts`,
      );
    }

    try {
      await this.postModel.collection.dropIndex(
        'status_1_likes_-1_createdAt_-1',
      );
    } catch {
      // Index may already be dropped.
    }
  }

  private async purgeLegacyCollections(): Promise<void> {
    const db = this.postModel.db;
    const legacyCollections = [
      'userblocks',
      'postapplications',
      'postapplicationmessages',
      'postlikes',
    ];

    for (const name of legacyCollections) {
      try {
        await db.dropCollection(name);
        this.logger.log(`Dropped legacy collection ${name}`);
      } catch (error) {
        const codeName = (error as { codeName?: string }).codeName;
        if (codeName !== 'NamespaceNotFound') {
          this.logger.warn(
            `Failed to drop ${name}: ${(error as Error).message}`,
          );
        }
      }
    }
  }

  private async purgePostsForRemovedActivities(): Promise<void> {
    const activities = await this.activityLookup.findAll();
    const validLegacyIds = activities.map((activity) => activity.legacyId);
    const result = await this.postModel.deleteMany({
      activityLegacyId: { $exists: true, $nin: validLegacyIds },
    });
    if (result.deletedCount > 0) {
      this.logger.log(
        `Purged ${result.deletedCount} posts tied to removed activities`,
      );
    }
  }
}
