import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEMO_OWNER_USER_ID,
  isDemoOwnerClient,
} from '../../common/utils/demo-owner.util';
import {
  PostApplication,
  PostApplicationDocument,
} from '../../database/schemas/post-application.schema';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  UserBlock,
  UserBlockDocument,
} from '../../database/schemas/user-block.schema';

function resolveActorUserId(userId?: string, authorName?: string): string {
  const uid = userId?.trim();
  if (isDemoOwnerClient(uid, authorName)) {
    return DEMO_OWNER_USER_ID;
  }
  return uid || DEMO_OWNER_USER_ID;
}

@Injectable()
export class UserBlockService {
  constructor(
    @InjectModel(UserBlock.name)
    private readonly blockModel: Model<UserBlockDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
  ) {}

  blockForClient(
    blockedUserId: string,
    userId?: string,
    authorName?: string,
  ): Promise<{ ok: true }> {
    return this.blockUser(
      resolveActorUserId(userId, authorName),
      blockedUserId,
    );
  }

  unblockForClient(
    blockedUserId: string,
    userId?: string,
    authorName?: string,
  ): Promise<{ ok: true }> {
    return this.unblockUser(
      resolveActorUserId(userId, authorName),
      blockedUserId,
    );
  }

  async listBlocksForClient(
    userId?: string,
    authorName?: string,
  ): Promise<{ blockedUserIds: string[] }> {
    const actorId = resolveActorUserId(userId, authorName);
    const blockedUserIds = await this.listBlockedUserIds(actorId);
    return { blockedUserIds };
  }

  async blockUser(userId: string, blockedUserId: string): Promise<{ ok: true }> {
    const actorId = userId.trim();
    const targetId = blockedUserId.trim();
    if (!actorId || !targetId) {
      throw new BadRequestException('无效的用户');
    }
    if (actorId === targetId) {
      throw new BadRequestException('不能拉黑自己');
    }

    try {
      await this.blockModel.create({ userId: actorId, blockedUserId: targetId });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('已拉黑该用户');
      }
      throw error;
    }

    return { ok: true };
  }

  async unblockUser(
    userId: string,
    blockedUserId: string,
  ): Promise<{ ok: true }> {
    const result = await this.blockModel.deleteOne({
      userId: userId.trim(),
      blockedUserId: blockedUserId.trim(),
    });
    if (!result.deletedCount) {
      throw new NotFoundException('未找到拉黑记录');
    }
    return { ok: true };
  }

  async listBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.blockModel
      .find({ userId: userId.trim() })
      .select('blockedUserId')
      .lean();
    return rows.map(row => row.blockedUserId).filter(Boolean);
  }

  /** Users the requester blocked plus users who blocked the requester. */
  async getBlockExclusionSet(userId: string): Promise<Set<string>> {
    const uid = userId.trim();
    if (!uid) return new Set();

    const [blocked, blockers] = await Promise.all([
      this.blockModel.find({ userId: uid }).select('blockedUserId').lean(),
      this.blockModel.find({ blockedUserId: uid }).select('userId').lean(),
    ]);

    const excluded = new Set<string>();
    for (const row of blocked) {
      if (row.blockedUserId) excluded.add(row.blockedUserId);
    }
    for (const row of blockers) {
      if (row.userId) excluded.add(row.userId);
    }
    return excluded;
  }

  async loadBlockedUserIds(userId: string): Promise<Set<string>> {
    const ids = await this.listBlockedUserIds(userId);
    return new Set(ids);
  }

  async loadBuddyUserIds(userId: string): Promise<Set<string>> {
    const buddyIds = new Set<string>();
    const uid = userId.trim();
    if (!uid) return buddyIds;

    const acceptedApplications = await this.applicationModel
      .find({ userId: uid, status: 'accepted' })
      .select('postId')
      .lean();

    const appliedPostIds = acceptedApplications
      .map(row => row.postId)
      .filter(Boolean);
    if (appliedPostIds.length) {
      const posts = await this.postModel
        .find({ _id: { $in: appliedPostIds } })
        .select('userId')
        .lean();

      for (const post of posts) {
        if (post.userId) buddyIds.add(post.userId);
      }
    }

    const ownedPosts = await this.postModel
      .find({ userId: uid })
      .select('_id')
      .lean();

    const ownedPostIds = ownedPosts.map(post => String(post._id));
    if (ownedPostIds.length) {
      const acceptedOnOwnedPosts = await this.applicationModel
        .find({ postId: { $in: ownedPostIds }, status: 'accepted' })
        .select('userId')
        .lean();

      for (const application of acceptedOnOwnedPosts) {
        if (application.userId) buddyIds.add(application.userId);
      }
    }

    return buddyIds;
  }
}
