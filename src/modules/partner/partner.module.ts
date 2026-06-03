import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PostApplication,
  PostApplicationSchema,
} from '../../database/schemas/post-application.schema';
import {
  PostApplicationMessage,
  PostApplicationMessageSchema,
} from '../../database/schemas/post-application-message.schema';
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
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { UserModule } from '../user/user.module';
import { PostInteractionService } from './post-interaction.service';
import { PartnerWriteModule } from './partner-write.module';
import { PostController } from './post.controller';
import { PartnerRepositoryModule } from './partner-repository.module';
import { PostService } from './post.service';
import { TeamChatController } from './team-chat.controller';
import { TeamChatService } from './team-chat.service';

@Module({
  imports: [
    UserModule,
    forwardRef(() => ActivityModule),
    PartnerRepositoryModule,
    PartnerWriteModule,
    RecruitmentModule,
    NotificationModule,
    ChromaModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: PostApplication.name, schema: PostApplicationSchema },
      {
        name: PostApplicationMessage.name,
        schema: PostApplicationMessageSchema,
      },
      { name: PostComment.name, schema: PostCommentSchema },
    ]),
  ],
  controllers: [PostController, TeamChatController],
  providers: [PostInteractionService, PostService, TeamChatService],
  exports: [
    PostService,
    PartnerWriteModule,
    PostInteractionService,
    PartnerRepositoryModule,
    RecruitmentModule,
    TeamChatService,
  ],
})
export class PartnerModule {}
