import {
  BadRequestException,
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
import { UserService } from '../user/user.service';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostMapper } from './post.mapper';
import { normalizeUserImageUrls } from '../../common/media/user-image-ref.util';
import { MAX_POST_IMAGES } from './utils/post-content-type.util';
import {
  assertUserUgcTexts,
  collectPostWriteUgcTexts,
} from '../../common/media/user-ugc-text.util';
import { assertUserUgcImages } from '../../common/media/user-ugc-image.util';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { MediaSecurityCheckService } from '../media-security/media-security-check.service';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from './interfaces/post.repository.interface';
import { PostWriteService } from './application/post-write.service';
import { PostQueryService } from './application/post-query.service';
import { PostInteractionService } from './post-interaction.service';

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
    private readonly postInteraction: PostInteractionService,
    private readonly userService: UserService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
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

  likePost(id: string, actor: RequestActor) {
    return this.postInteraction.likePost(id, actor);
  }

  listComments(id: string, options: { limit?: number; cursor?: string }) {
    return this.postInteraction.listComments(id, options);
  }

  addComment(
    id: string,
    body: string,
    actor: RequestActor,
    parentCommentId?: string,
  ) {
    return this.postInteraction.addComment(id, body, actor, parentCommentId);
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

  async updateOwnedPost(id: string, dto: UpdatePostDto, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (!(await this.isOwnedPost(post, actor))) {
      throw new ForbiddenException('无权编辑该帖子');
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectPostWriteUgcTexts(dto),
    );

    const patch: Partial<PostRecord> = {};
    if (dto.body !== undefined) patch.body = dto.body.trim();
    if (dto.eventTitle !== undefined) patch.eventTitle = dto.eventTitle.trim();
    if (dto.location !== undefined) patch.location = dto.location.trim();
    if (dto.departureCity !== undefined) {
      patch.departureCity = dto.departureCity.trim();
    }
    if (dto.images) {
      const normalized = normalizeUserImageUrls(dto.images);
      if (normalized.length > MAX_POST_IMAGES) {
        throw new BadRequestException(`最多上传 ${MAX_POST_IMAGES} 张图片`);
      }
      await assertUserUgcImages(
        this.wechatContentSecurity,
        this.mediaChecks,
        normalized,
        actor.resolvedUserId,
      );
      patch.images = normalized;
    }

    if (Object.keys(patch).length === 0) {
      return PostMapper.toProfileItem(post);
    }

    const updated = await this.repository.updateById(id, patch);
    if (!updated) {
      throw new NotFoundException('帖子不存在');
    }
    return PostMapper.toProfileItem(updated);
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
      await this.postInteraction.deleteInteractionsForPost(id);
    } catch (error) {
      this.logger.warn(
        `Failed to delete interactions for post ${id}: ${
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
