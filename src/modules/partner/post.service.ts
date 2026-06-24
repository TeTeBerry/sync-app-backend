import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { isPostOwnedByActor } from '../../common/auth/actor-query.util';
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
import { BuddyPostComposeService } from './application/buddy-post-compose.service';
import { PostDevMockSeedService } from './application/post-dev-mock-seed.service';
import type { AiComposePostsDto } from './dto/ai-compose-posts.dto';
import { TML_THAILAND_LEGACY_ID } from './data/dev-mock-buddy-posts.util';

@Injectable()
export class PostService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly postWrite: PostWriteService,
    private readonly postQuery: PostQueryService,
    private readonly postComments: PostCommentService,
    private readonly postSearch: PostSearchService,
    private readonly buddyPostCompose: BuddyPostComposeService,
    private readonly userService: UserService,
    private readonly devMockSeed: PostDevMockSeedService,
  ) {}

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
    options?: { applyPreferenceRank?: boolean },
  ) {
    return this.postSearch.searchByNaturalLanguage(
      query,
      activityLegacyId,
      actor,
      options,
    );
  }

  composeBuddyPostCandidates(dto: AiComposePostsDto, actor: RequestActor) {
    return this.buddyPostCompose.compose(dto, actor);
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
    if (post.activityLegacyId != null) {
      void this.activityLookup.refreshCache().catch(() => undefined);
    }
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
}
