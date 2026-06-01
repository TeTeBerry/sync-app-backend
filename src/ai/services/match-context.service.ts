import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { UserBlockService } from '../../modules/user/user-block.service';
import type { PostMatchResult } from '../rag/chroma.service';
import {
  MatchFilterContext,
  RankablePostCandidate,
  UserMatchProfile,
} from '../match/match-ranking.util';
import { UserService } from '../../modules/user/user.service';

@Injectable()
export class MatchContextService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly userService: UserService,
    private readonly userBlockService: UserBlockService,
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
    actor?: RequestActor,
    profile?: UserMatchProfile,
  ): Promise<MatchFilterContext> {
    const requesterUserId = actor?.resolvedUserId?.trim() || undefined;
    const resolvedProfile = await this.resolveProfile(actor, profile);

    if (!requesterUserId) {
      return {
        requesterUserId: undefined,
        profile: resolvedProfile,
        blockedUserIds: new Set<string>(),
        buddyUserIds: new Set<string>(),
      };
    }

    const [blockedUserIds, buddyUserIds] = await Promise.all([
      this.userBlockService.getBlockExclusionSet(requesterUserId),
      this.userBlockService.loadBuddyUserIds(requesterUserId),
    ]);

    return {
      requesterUserId,
      profile: resolvedProfile,
      blockedUserIds,
      buddyUserIds,
    };
  }

  async enrichCandidates(
    raw: PostMatchResult[],
    postById?: Map<
      string,
      Pick<
        PostDocument,
        'userId' | 'location' | 'tags' | 'body' | 'departureCity'
      >
    >,
  ): Promise<RankablePostCandidate[]> {
    const postIds = [
      ...new Set(raw.map((item) => item.postId).filter(Boolean)),
    ];
    if (!postIds.length) return [];

    const resolvedPostMap = new Map<
      string,
      Pick<
        PostDocument,
        'userId' | 'location' | 'tags' | 'body' | 'departureCity'
      >
    >();

    if (postById) {
      for (const id of postIds) {
        const post = postById.get(id);
        if (post) resolvedPostMap.set(id, post);
      }
    } else {
      const posts = await this.postModel
        .find({ _id: { $in: postIds } })
        .select('userId location tags body departureCity')
        .lean();
      for (const post of posts) {
        resolvedPostMap.set(String(post._id), post);
      }
    }

    const authorIds = [
      ...new Set(
        [...resolvedPostMap.values()]
          .map((post) => post.userId)
          .filter(Boolean),
      ),
    ];

    const users = authorIds.length
      ? await this.userModel
          .find({ externalId: { $in: authorIds } })
          .select('externalId city favorGenres likeMate')
          .lean()
      : [];

    const userMap = new Map(
      users
        .filter((user) => user.externalId)
        .map((user) => [String(user.externalId), user]),
    );

    return raw.map((item) => {
      const post = resolvedPostMap.get(item.postId);
      const author = post?.userId ? userMap.get(post.userId) : undefined;

      return {
        postId: item.postId,
        document: item.document,
        distance: item.distance,
        profileDistance: item.profileDistance,
        authorUserId: post?.userId ?? '',
        postCity: post?.location,
        postTags: post?.tags,
        postBody: post?.body,
        postDepartureCity: post?.departureCity,
        author: post?.userId
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
    actor?: RequestActor,
    profile?: UserMatchProfile,
  ): Promise<UserMatchProfile | undefined> {
    if (profile) return profile;
    if (!actor?.clientUserId.trim()) return undefined;

    try {
      const me = await this.userService.getMe(actor);
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
}
