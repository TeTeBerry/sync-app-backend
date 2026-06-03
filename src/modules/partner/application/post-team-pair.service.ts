import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { isResourceOwnedByActor } from '../../../common/auth/actor-query.util';
import {
  PostApplication,
  PostApplicationDocument,
} from '../../../database/schemas/post-application.schema';
import { PostRecruitmentService } from '../../recruitment/application/post-recruitment.service';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../interfaces/post.repository.interface';
import {
  IPostNotificationPort,
  POST_NOTIFICATION_PORT,
} from '../ports/post-notification.port';
import { PostWriteService } from './post-write.service';
import {
  isPostRecruiting,
  isRecruitmentClosed,
} from '../../recruitment/domain/post-status.util';

@Injectable()
export class PostTeamPairService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
    private readonly postRecruitmentService: PostRecruitmentService,
    private readonly postWriteService: PostWriteService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
  ) {}

  /**
   * 帖主将已组队帖改回招募中：若与申请人互为 accepted 组队，则双方帖子均恢复招募并通知对方。
   */
  async reopenRecruitmentAndDissolve(
    postId: string,
    actor: RequestActor,
  ): Promise<PostRecord> {
    const post = await this.repository.findById(postId);
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

    if (!isRecruitmentClosed(post.status)) {
      throw new BadRequestException('仅已组队的帖子可改回招募中');
    }

    const ownerUserId = post.userId?.trim();
    if (!ownerUserId) {
      throw new BadRequestException('帖子作者信息缺失');
    }

    const acceptedBuddyUserId = await this.findAcceptedApplicantUserId(postId);
    const actorName = actor.displayName?.trim() || '对方';

    const counterpart =
      acceptedBuddyUserId != null
        ? await this.findMutualCounterpartPost(
            post,
            ownerUserId,
            acceptedBuddyUserId,
          )
        : null;

    const reopenedPrimary = await this.reopenSinglePost(
      postId,
      post,
      counterpart ? 'mutual_team_dissolved' : 'owner_reopen_recruiting',
    );

    if (acceptedBuddyUserId) {
      await this.resetApplicationToPending(postId, acceptedBuddyUserId);
    }

    if (counterpart && acceptedBuddyUserId) {
      const buddyUserId = acceptedBuddyUserId;
      const counterpartId = String(counterpart._id);
      await this.reopenSinglePost(
        counterpartId,
        counterpart,
        'mutual_team_dissolved',
      );
      await this.resetApplicationToPending(counterpartId, ownerUserId);
      void this.postNotification.notifyTeamDissolved(
        buddyUserId,
        postId,
        post.activityLegacyId,
        actorName,
      );
    } else if (acceptedBuddyUserId) {
      void this.postNotification.notifyTeamDissolved(
        acceptedBuddyUserId,
        postId,
        post.activityLegacyId,
        actorName,
      );
    }

    return reopenedPrimary;
  }

  /**
   * 帖主接受申请人组队：关闭申请人同活动下招募帖，并通知申请人。
   * 若双方互有 accepted，再同步处理对方帖（与 syncMutualCounterpartCompletion 互补）。
   */
  async onOwnerAcceptedApplication(
    ownerPost: PostRecord,
    applicantUserId: string,
    ownerDisplayName: string,
  ): Promise<void> {
    const buddyUserId = applicantUserId.trim();
    const ownerPostId = String(ownerPost._id);
    const ownerName = ownerDisplayName.trim() || '发帖人';

    await this.completeBuddyRecruitingPostsOnActivity(
      ownerPost,
      buddyUserId,
      ownerPostId,
    );
    await this.syncMutualCounterpartCompletion(ownerPost, buddyUserId);

    void this.postNotification.notifyApplicationAccepted(
      buddyUserId,
      ownerPostId,
      ownerPost.activityLegacyId,
      ownerName,
    );
  }

  /** 接受组队后，若对方帖上已有对自己的 accepted 申请，则同步关闭对方帖招募。 */
  async syncMutualCounterpartCompletion(
    post: PostRecord,
    acceptedApplicantUserId: string,
  ): Promise<void> {
    const ownerUserId = post.userId?.trim();
    const buddyUserId = acceptedApplicantUserId.trim();
    if (!ownerUserId || !buddyUserId) return;

    const counterpart = await this.findMutualCounterpartPost(
      post,
      ownerUserId,
      buddyUserId,
    );
    if (!counterpart || isRecruitmentClosed(counterpart.status)) {
      return;
    }

    const reverseAccepted = await this.applicationModel
      .findOne({
        postId: String(counterpart._id),
        userId: ownerUserId,
        status: 'accepted',
      })
      .lean();
    if (!reverseAccepted) {
      return;
    }

    await this.postRecruitmentService.completeRecruitment(
      String(counterpart._id),
      'buddy_teamed',
      counterpart,
    );
  }

  private async reopenSinglePost(
    postId: string,
    current: PostRecord,
    reason: 'owner_reopen_recruiting' | 'mutual_team_dissolved',
  ): Promise<PostRecord> {
    const reopened = await this.postRecruitmentService.reopenRecruitment(
      postId,
      reason,
      current,
    );
    if (!reopened) {
      throw new NotFoundException('帖子不存在');
    }
    this.postWriteService.scheduleEmbeddingSyncForRecord(reopened);
    return reopened;
  }

  private async findAcceptedApplicantUserId(
    postId: string,
  ): Promise<string | null> {
    const row = await this.applicationModel
      .findOne({ postId, status: 'accepted' })
      .lean();
    return row?.userId?.trim() || null;
  }

  private async findMutualCounterpartPost(
    post: PostRecord,
    ownerUserId: string,
    buddyUserId: string,
  ): Promise<PostRecord | null> {
    const activityLegacyId = post.activityLegacyId;
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      return null;
    }

    const buddyPosts = await this.repository.findByOwner({
      userId: buddyUserId,
      activityLegacyId,
    });

    for (const candidate of buddyPosts) {
      const candidateId = String(candidate._id);
      if (candidateId === String(post._id)) continue;
      if (!isRecruitmentClosed(candidate.status)) continue;

      const reverseAccepted = await this.applicationModel
        .findOne({
          postId: candidateId,
          userId: ownerUserId,
          status: 'accepted',
        })
        .lean();
      if (reverseAccepted) {
        return candidate;
      }
    }

    return null;
  }

  private async completeBuddyRecruitingPostsOnActivity(
    ownerPost: PostRecord,
    buddyUserId: string,
    ownerPostId: string,
  ): Promise<void> {
    const activityLegacyId = ownerPost.activityLegacyId;
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      return;
    }

    const buddyPosts = await this.repository.findByOwner({
      userId: buddyUserId,
      activityLegacyId,
    });

    for (const buddyPost of buddyPosts) {
      const buddyPostId = String(buddyPost._id);
      if (buddyPostId === ownerPostId) continue;
      if (!isPostRecruiting(buddyPost.status)) continue;

      await this.postRecruitmentService.completeRecruitment(
        buddyPostId,
        'buddy_teamed',
        buddyPost,
      );
    }
  }

  private async resetApplicationToPending(
    postId: string,
    applicantUserId: string,
  ): Promise<void> {
    await this.applicationModel.updateOne(
      { postId, userId: applicantUserId.trim(), status: 'accepted' },
      { status: 'pending' },
    );
  }
}
