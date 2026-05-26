import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isResourceOwnedByClient } from '../../common/utils/demo-owner.util';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import { PostMapper } from './post.mapper';
import { POST_SEED } from './post.seed';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostQueryFilter,
} from './interfaces/post.repository.interface';

function resolveOwnerFilter(userId?: string, authorName?: string): PostQueryFilter {
  return {
    userId: userId?.trim() || undefined,
    authorName: authorName?.trim() || undefined,
  };
}

@Injectable()
export class PostService implements OnModuleInit {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async onModuleInit() {
    const count = await this.postModel.estimatedDocumentCount();
    if (count === 0) {
      await this.postModel.insertMany(POST_SEED);
    }
  }

  listPopular(limit = 20) {
    return this.repository
      .findPopular(limit)
      .then(rows => rows.map(PostMapper.toHomeFeedItem));
  }

  listByActivity(activityLegacyId: number) {
    return this.repository
      .findByActivityLegacyId(activityLegacyId)
      .then(rows => rows.map(PostMapper.toEventDetailItem));
  }

  listByOwner(userId?: string, authorName?: string) {
    const filter = resolveOwnerFilter(userId, authorName);
    return this.repository
      .findByOwner(filter)
      .then(rows => rows.map(PostMapper.toProfileItem));
  }

  async deleteOwnedPost(id: string, userId?: string, authorName?: string) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const isOwner = isResourceOwnedByClient(
      { userId: post.userId, authorName: post.authorName },
      userId,
      authorName,
    );

    if (!isOwner) {
      throw new ForbiddenException('无权删除该帖子');
    }

    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('帖子不存在');
    }

    return { ok: true as const };
  }

  countByOwner(userId?: string, authorName?: string) {
    return this.repository.countByOwner(resolveOwnerFilter(userId, authorName));
  }

  sumLikesByOwner(userId?: string, authorName?: string) {
    return this.repository.sumLikesByOwner(resolveOwnerFilter(userId, authorName));
  }
}
