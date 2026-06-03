import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChromaService } from '../../../ai/rag/chroma.service';
import type { PostStatus } from '../../../database/schemas/post.schema';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../../partner/interfaces/post.repository.interface';
import type {
  PostRecruitmentCloseReason,
  PostRecruitmentReopenReason,
} from '../domain/post-status.util';
import {
  isPostRecruiting,
  isRecruitmentClosed,
} from '../domain/post-status.util';

@Injectable()
export class PostRecruitmentService {
  private readonly logger = new Logger(PostRecruitmentService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly chromaService: ChromaService,
  ) {}

  /**
   * 结束招募：recruiting → completed。
   * 招募关闭语义由 closeReason 区分。
   */
  async completeRecruitment(
    postId: string,
    reason: PostRecruitmentCloseReason,
    current?: PostRecord | null,
  ): Promise<PostRecord | null> {
    const post = current ?? (await this.repository.findById(postId));
    if (!post) {
      return null;
    }

    if (!isPostRecruiting(post.status)) {
      return post;
    }

    const updated = await this.repository.updateById(postId, {
      status: 'completed' satisfies PostStatus,
    });
    const record = (updated ?? {
      ...post,
      status: 'completed' as PostStatus,
    }) as PostRecord;

    void this.chromaService.deprecatePostEmbedding(postId).catch((error) => {
      this.logger.warn(
        `Chroma deprecate failed for post ${postId}: ${(error as Error).message}`,
      );
    });
    this.logger.log(`Post ${postId} recruitment closed: ${reason}`);

    return record;
  }

  /** 重新开放招募：completed → recruiting（如组队解散、帖主改回招募中）。 */
  async reopenRecruitment(
    postId: string,
    reason: PostRecruitmentReopenReason,
    current?: PostRecord | null,
  ): Promise<PostRecord | null> {
    const post = current ?? (await this.repository.findById(postId));
    if (!post) {
      return null;
    }

    if (isPostRecruiting(post.status)) {
      return post;
    }

    if (!isRecruitmentClosed(post.status)) {
      return post;
    }

    const updated = await this.repository.updateById(postId, {
      status: 'recruiting' satisfies PostStatus,
    });
    const record = (updated ?? {
      ...post,
      status: 'recruiting' as PostStatus,
    }) as PostRecord;

    this.logger.log(`Post ${postId} recruitment reopened: ${reason}`);

    return record;
  }
}
