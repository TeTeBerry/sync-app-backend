import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PostApplication,
  PostApplicationSchema,
} from '../../database/schemas/post-application.schema';
import {
  PostComment,
  PostCommentSchema,
} from '../../database/schemas/post-comment.schema';
import {
  PostLike,
  PostLikeSchema,
} from '../../database/schemas/post-like.schema';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { AgentsModule } from '../../ai/agents/agents.module';
import { ChromaModule } from '../../ai/rag/chroma.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { POST_REPOSITORY } from './interfaces/post.repository.interface';
import { PostController } from './post.controller';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

@Module({
  imports: [
    UserModule,
    forwardRef(() => ActivityModule),
    forwardRef(() => AgentsModule),
    NotificationModule,
    ChromaModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: PostApplication.name, schema: PostApplicationSchema },
      { name: PostComment.name, schema: PostCommentSchema },
    ]),
  ],
  controllers: [PostController],
  providers: [
    PostRepository,
    { provide: POST_REPOSITORY, useExisting: PostRepository },
    PostService,
  ],
  exports: [PostService, POST_REPOSITORY],
})
export class PostModule {}
