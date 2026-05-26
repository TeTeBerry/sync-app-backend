import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PostApplication,
  PostApplicationDocument,
} from '../../database/schemas/post-application.schema';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  UserBlock,
  UserBlockDocument,
} from '../../database/schemas/user-block.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import type { PostMatchResult } from '../rag/chroma.service';
import {
  MatchFilterContext,
  RankablePostCandidate,
  UserMatchProfile,
} from '../utils/match-ranking.util';
import { UserService } from '../../modules/user/user.service';

@Injectable()
export class MatchContextService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
    @InjectModel(UserBlock.name)
    private readonly blockModel: Model<UserBlockDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly userService: UserService,
  ) {}

  buildExcludeUserIds(context: MatchFilterContext): string[] {
    const excluded = new Set<string>();
    const requesterId = context.requesterUserId?.trim();
    if (requesterId) excluded.add(requesterId);

    for (const userId of context.blockedUserIds) {
      if (userId) excluded.add(userId);
    }
    for (const userId of context.buddyUserIds) {
      if (userId) excluded.add(userId);
    }

    return [...excluded];
  }

  async buildFilterContext(
    userId?: string,
    profile?: UserMatchProfile,
  ): Promise<MatchFilterContext> {
    const requesterUserId = userId?.trim();
    const resolvedProfile = await this.resolveProfile(requesterUserId, profile);

    if (!requesterUserId) {
      return {
        requesterUserId: undefined,
        profile: resolvedProfile,
        blockedUserIds: new Set<string>(),
        buddyUserIds: new Set<string>(),
      };
    }

    const [blockedUserIds, buddyUserIds] = await Promise.all([
      this.loadBlockedUserIds(requesterUserId),
      this.loadBuddyUserIds(requesterUserId),
    ]);

    return {
      requesterUserId,
      profile: resolvedProfile,
      blockedUserIds,
      buddyUserIds,
    };
  }

  async enrichCandidates(raw: PostMatchResult[]): Promise<RankablePostCandidate[]> {
    const postIds = [...new Set(raw.map(item => item.postId).filter(Boolean))];
    if (!postIds.length) return [];

    const posts = await this.postModel
      .find({ _id: { $in: postIds } })
      .select('userId location tags')
      .lean();

    const postMap = new Map(posts.map(post => [String(post._id), post]));
    const authorIds = [
      ...new Set(posts.map(post => post.userId).filter(Boolean)),
    ];

    const users = authorIds.length
      ? await this.userModel
          .find({ externalId: { $in: authorIds } })
          .select('externalId city favorGenres likeMate')
          .lean()
      : [];

    const userMap = new Map(
      users
        .filter(user => user.externalId)
        .map(user => [String(user.externalId), user]),
    );

    return raw.map(item => {
      const post = postMap.get(item.postId);
      const author = post ? userMap.get(post.userId) : undefined;

      return {
        postId: item.postId,
        document: item.document,
        distance: item.distance,
        profileDistance: item.profileDistance,
        authorUserId: post?.userId ?? '',
        postCity: post?.location,
        postTags: post?.tags,
        author: post
          ? {
              userId: post.userId,
              city: author?.city,
              favorGenres: author?.favorGenres,
              likeMate: author?.likeMate,
            }
          : undefined,
      };
    });
  }

  private async resolveProfile(
    userId?: string,
    profile?: UserMatchProfile,
  ): Promise<UserMatchProfile | undefined> {
    if (profile) return profile;
    if (!userId) return undefined;

    try {
      const me = await this.userService.getMe(userId);
      return {
        city: me.city,
        favorGenres: me.favorGenres,
        likeMate: me.likeMate,
        budgetLevel: me.budgetLevel,
      };
    } catch {
      return undefined;
    }
  }

  private async loadBlockedUserIds(userId: string): Promise<Set<string>> {
    const rows = await this.blockModel
      .find({ userId })
      .select('blockedUserId')
      .lean();

    return new Set(rows.map(row => row.blockedUserId).filter(Boolean));
  }

  private async loadBuddyUserIds(userId: string): Promise<Set<string>> {
    const buddyIds = new Set<string>();

    const acceptedApplications = await this.applicationModel
      .find({ userId, status: 'accepted' })
      .select('postId')
      .lean();

    const appliedPostIds = acceptedApplications.map(row => row.postId).filter(Boolean);
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
      .find({ userId })
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
