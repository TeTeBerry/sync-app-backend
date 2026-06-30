import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { NotificationModule } from '../notification/notification.module';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { UserModule } from '../user/user.module';
import { PostQueryService } from './application/post-query.service';
import { PartnerWriteModule } from './partner-write.module';
import { PostController } from './post.controller';
import { PartnerRepositoryModule } from './partner-repository.module';
import { PostService } from './post.service';
import { MediaSecurityModule } from '../media-security/media-security.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import {
  PostComment,
  PostCommentSchema,
} from '../../database/schemas/post-comment.schema';
import { PostCommentService } from './application/post-comment.service';
import { BuddyPostSearchParseService } from './application/buddy-post-search-parse.service';
import { BuddyPostComposeService } from './application/buddy-post-compose.service';
import { PostSearchService } from './application/post-search.service';
import { PostDevMockSeedService } from './application/post-dev-mock-seed.service';

@Module({
  imports: [
    AuthModule,
    UserModule,
    AccountRiskModule,
    MediaSecurityModule,
    ActivityLookupModule,
    PartnerRepositoryModule,
    PartnerWriteModule,
    NotificationModule,
    InfraLlmModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostComment.name, schema: PostCommentSchema },
    ]),
  ],
  controllers: [PostController],
  providers: [
    PostQueryService,
    PostService,
    PostCommentService,
    BuddyPostSearchParseService,
    BuddyPostComposeService,
    PostSearchService,
    PostDevMockSeedService,
  ],
  exports: [
    PostService,
    PartnerWriteModule,
    PostQueryService,
    PostCommentService,
    PostSearchService,
    PartnerRepositoryModule,
  ],
})
export class PartnerModule {}
