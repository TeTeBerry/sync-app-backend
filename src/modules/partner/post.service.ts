import {
  BadRequestException,
  ConflictException,
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
import { isResourceOwnedByActor } from '../../common/auth/actor-query.util';
import { resolveOwnerFilterFromActor } from '../../common/utils/owner-filter.util';
import { sumProfilePostLikes } from '../../common/utils/profile-likes.util';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import { ActivityService } from '../activity/activity.service';
import {
  IPostNotificationPort,
  POST_NOTIFICATION_PORT,
} from './ports/post-notification.port';
import { UserBlockService } from '../user/user-block.service';
import { UserService } from '../user/user.service';
import type { PostStatus } from '../../database/schemas/post.schema';
import { ApplyToPostDto } from './dto/apply-to-post.dto';
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
  POST_SEED,
  STORM_ACTIVITY_LEGACY_ID,
  STORM_COMPLETED_DEMO_POST_SEED,
  STORM_DEMO_POST_SEED,
} from './post.seed';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostQueryFilter,
  PostRecord,
} from './interfaces/post.repository.interface';
import { PostWriteService } from './application/post-write.service';
import { PostQueryService } from './application/post-query.service';
import { PostInteractionService } from './post-interaction.service';
import {
  inferDepartureCityFromText,
  normalizeCityName,
  resolveDepartureCity,
} from './utils/departure-city.util';
import { PostRecruitmentService } from '../recruitment/application/post-recruitment.service';
import { PostTeamPairService } from './application/post-team-pair.service';

@Injectable()
export class PostService implements OnModuleInit {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    private readonly userService: UserService,
    private readonly userBlockService: UserBlockService,
    private readonly activityService: ActivityService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    private readonly postWriteService: PostWriteService,
    private readonly postQuery: PostQueryService,
    private readonly postInteraction: PostInteractionService,
    private readonly postRecruitmentService: PostRecruitmentService,
    private readonly postTeamPairService: PostTeamPairService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.postModel.estimatedDocumentCount();
      if (count === 0) {
        await this.postModel.insertMany(POST_SEED);
      }
    } catch (error) {
      this.logger.warn(`Post seed failed: ${(error as Error).message}`);
    }

    try {
      await this.ensureStormDemoPosts();
    } catch (error) {
      this.logger.warn(
        `Storm demo posts init failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.ensureStormCompletedDemoPosts();
    } catch (error) {
      this.logger.warn(
        `Storm completed demo posts init failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.purgePostsForRemovedActivities();
    } catch (error) {
      this.logger.warn(
        `Expired activity post cleanup failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.patchStormDemoDepartureCities();
    } catch (error) {
      this.logger.warn(
        `Departure city patch failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.postInteraction.ensureDemoPostComments();
    } catch (error) {
      this.logger.warn(`Demo comment seed failed: ${(error as Error).message}`);
    }
  }

  /** 已有库时补全风暴电音节招募帖，便于测 AI 搭子推荐卡片 */
  private async ensureStormDemoPosts(): Promise<void> {
    const recruitingCount = await this.postModel.countDocuments({
      activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
      status: 'recruiting',
    });
    if (recruitingCount >= 10) {
      return;
    }

    const inserted: PostDocument[] = [];

    for (const seed of STORM_DEMO_POST_SEED) {
      const exists = await this.postModel.exists({
        activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
        userId: seed.userId,
        body: seed.body,
      });
      if (exists) continue;

      const doc = await this.postModel.create(seed);
      inserted.push(doc);
    }
  }

  /** 已有库时补全风暴电音节「已组队」帖，便于活动详情组队完成态测试 */
  private async ensureStormCompletedDemoPosts(): Promise<void> {
    for (const seed of STORM_COMPLETED_DEMO_POST_SEED) {
      const exists = await this.postModel.exists({
        activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
        userId: seed.userId,
        body: seed.body,
      });
      if (exists) continue;
      await this.postModel.create(seed);
    }
  }

  private async purgePostsForRemovedActivities(): Promise<void> {
    const activities = await this.activityService.findAll();
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

  private async patchStormDemoDepartureCities(): Promise<void> {
    for (const seed of STORM_DEMO_POST_SEED) {
      const departureCity =
        seed.departureCity ??
        normalizeCityName(seed.location) ??
        inferDepartureCityFromText(seed.body);
      if (!departureCity) continue;

      await this.postModel.updateMany(
        {
          activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
          userId: seed.userId,
          body: seed.body,
        },
        { $set: { departureCity } },
      );
    }
  }

  listApplicationsForPost(postId: string, actor: RequestActor) {
    return this.postInteraction.listApplicationsForPost(postId, actor);
  }

  listPopular(limit = 20, actor: RequestActor) {
    return this.postQuery.listPopular(limit, actor);
  }

  listByActivity(activityLegacyId: number, actor: RequestActor) {
    return this.postQuery.listByActivity(activityLegacyId, actor);
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

  findPostById(id: string): Promise<PostRecord | null> {
    return this.postQuery.findPostById(id);
  }

  findOwnerRecruitingPostForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    return this.postQuery.findOwnerRecruitingPostForActivity(
      activityLegacyId,
      actor,
    );
  }

  findOwnerRecruitingPostRecord(activityLegacyId: number, actor: RequestActor) {
    return this.postQuery.findOwnerRecruitingPostRecord(
      activityLegacyId,
      actor,
    );
  }

  findOwnerRecruitingPostRecordsForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    return this.postQuery.findOwnerRecruitingPostRecordsForActivity(
      activityLegacyId,
      actor,
    );
  }

  async createPost(
    dto: CreatePostDto,
    actor: RequestActor,
    options?: { skipRiskCheck?: boolean },
  ) {
    return this.postWriteService.createPost(dto, actor, options);
  }

  async hidePostForViolation(
    postId: string,
    reason?: string,
  ): Promise<boolean> {
    const post = await this.repository.findById(postId);
    if (!post || post.status === 'hidden') {
      return false;
    }

    const updated = await this.repository.updateById(postId, {
      status: 'hidden',
    });
    if (!updated) {
      return false;
    }

    void this.postNotification.notifyPostHidden(
      post.userId,
      postId,
      post.activityLegacyId,
      reason,
    );
    return true;
  }

  async updateOwnedPost(id: string, dto: UpdatePostDto, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (
      !isResourceOwnedByActor(
        { userId: post.userId, authorName: post.authorName },
        actor,
      )
    ) {
      throw new ForbiddenException('无权编辑该帖子');
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectPostWriteUgcTexts(dto),
    );

    const patch: Partial<Post> = {};
    if (dto.body?.trim()) {
      const nextBody = dto.body.trim();
      if (post.status === 'recruiting') {
        const similar = await this.repository.findOwnerSimilarRecruitingPost(
          post.userId,
          nextBody,
          post.activityLegacyId,
          String(post._id),
        );
        if (similar) {
          throw new ConflictException(
            '与其他招募帖内容过于相近，请修改后再保存。',
          );
        }
      }
      patch.body = nextBody;
    }
    if (dto.eventTitle?.trim()) patch.eventTitle = dto.eventTitle.trim();
    if (dto.location?.trim()) patch.location = dto.location.trim();
    if (dto.departureCity?.trim())
      patch.departureCity = dto.departureCity.trim();
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

    if (dto.body?.trim() || dto.departureCity?.trim() || dto.location?.trim()) {
      patch.departureCity = resolveDepartureCity({
        departureCity: dto.departureCity?.trim() ?? post.departureCity,
        location: dto.location?.trim() ?? post.location,
        body: (dto.body ?? post.body).trim(),
      });
    }

    if (dto.status === 'recruiting') {
      const reopened =
        await this.postTeamPairService.reopenRecruitmentAndDissolve(id, actor);
      return PostMapper.toProfileItem(reopened);
    }

    if (dto.status === 'completed') {
      const closed = await this.postRecruitmentService.completeRecruitment(
        id,
        'owner_manual',
        post,
      );
      if (!closed) {
        throw new NotFoundException('帖子不存在');
      }
      return PostMapper.toProfileItem(closed);
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('没有可更新的字段');
    }

    const updated = await this.repository.updateById(id, patch);
    if (!updated) {
      throw new NotFoundException('帖子不存在');
    }

    return PostMapper.toProfileItem(updated);
  }

  acceptPostApplication(
    postId: string,
    applicantUserId: string,
    owner?: RequestActor,
  ) {
    return this.postInteraction.acceptPostApplication(
      postId,
      applicantUserId,
      owner,
    );
  }

  likePost(id: string, actor: RequestActor) {
    return this.postInteraction.likePost(id, actor);
  }

  applyToPost(id: string, actor: RequestActor, body?: ApplyToPostDto) {
    return this.postInteraction.applyToPost(id, actor, body);
  }

  listComments(id: string, options?: { limit?: number; cursor?: string }) {
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

  async deleteOwnedPost(id: string, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const isOwner = isResourceOwnedByActor(
      { userId: post.userId, authorName: post.authorName },
      actor,
    );

    if (!isOwner) {
      throw new ForbiddenException('无权删除该帖子');
    }

    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('帖子不存在');
    }

    await this.postInteraction.deleteInteractionsForPost(id);

    return { ok: true as const };
  }

  countByOwner(actor: RequestActor) {
    return this.repository.countByOwner(resolveOwnerFilterFromActor(actor));
  }

  countCompletedByOwner(actor: RequestActor) {
    return this.repository.countCompletedByOwner(
      resolveOwnerFilterFromActor(actor),
    );
  }

  async sumLikesByOwner(actor: RequestActor) {
    const rows = await this.repository.findByOwner(
      resolveOwnerFilterFromActor(actor),
    );
    return sumProfilePostLikes(rows);
  }
}
