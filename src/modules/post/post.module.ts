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
import { ChromaModule } from '../../ai/rag/chroma.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { PostWriteService } from './application/post-write.service';
import { PostController } from './post.controller';
import { PostRepositoryModule } from './post-repository.module';
import { PostService } from './post.service';
import { PostInteractionService } from './post-interaction.service';

@Module({
  imports: [
    UserModule,
    forwardRef(() => ActivityModule),
    PostRepositoryModule,
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
  providers: [PostWriteService, PostInteractionService, PostService],
  exports: [PostService, PostWriteService, PostInteractionService, PostRepositoryModule],
})
export class PostModule {}
