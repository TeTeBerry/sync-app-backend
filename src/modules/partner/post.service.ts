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
  PostApplication,
  PostApplicationDocument,
} from '../../database/schemas/post-application.schema';
import {
  PostApplicationMessage,
  PostApplicationMessageDocument,
} from '../../database/schemas/post-application-message.schema';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { UserService } from '../user/user.service';
import { CreatePostDto } from './dto/create-post.dto';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from './interfaces/post.repository.interface';
import { PostWriteService } from './application/post-write.service';
import { PostQueryService } from './application/post-query.service';

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
    private readonly userService: UserService,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
    @InjectModel(PostApplicationMessage.name)
    private readonly applicationMessageModel: Model<PostApplicationMessageDocument>,
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

  listByActivityPage(
    activityLegacyId: number,
    options: {
      limit?: number;
      cursor?: string;
      anchorPostId?: string;
    },
    actor: RequestActor,
  ) {
    return this.postQuery.listByActivityPage(activityLegacyId, options, actor);
  }

  listByOwner(actor: RequestActor) {
    return this.postQuery.listByOwner(actor);
  }

  createPost(
    dto: CreatePostDto,
    actor: RequestActor,
    options?: { skipRiskCheck?: boolean },
  ) {
    return this.postWrite.createPost(dto, actor, options);
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

  async getPostNavigationTarget(id: string) {
    const post = await this.postQuery.findPostById(id);
    if (!post || post.status === 'hidden') {
      throw new NotFoundException('帖子不存在');
    }

    const rawLegacyId = post.activityLegacyId;
    const activityLegacyId =
      rawLegacyId != null && !Number.isNaN(Number(rawLegacyId))
        ? Number(rawLegacyId)
        : null;
    if (activityLegacyId == null || activityLegacyId <= 0) {
      throw new NotFoundException('帖子未关联活动');
    }

    return {
      postId: String(post._id),
      activityLegacyId,
    };
  }

  async deleteOwnedPost(id: string, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (!(await this.isOwnedPost(post, actor))) {
      throw new ForbiddenException('无权删除该帖子');
    }

    try {
      await Promise.all([
        this.applicationModel.deleteMany({ postId: id }),
        this.applicationMessageModel.deleteMany({ postId: id }),
      ]);
    } catch (error) {
      this.logger.warn(
        `Failed to delete applications for post ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('帖子不存在');
    }
    return { ok: true as const };
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
