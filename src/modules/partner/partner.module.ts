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
import { MongooseModule } from '@nestjs/mongoose';
import {
  PostApplication,
  PostApplicationSchema,
} from '../../database/schemas/post-application.schema';
import {
  PostApplicationMessage,
  PostApplicationMessageSchema,
} from '../../database/schemas/post-application-message.schema';
import { Post, PostSchema } from '../../database/schemas/post.schema';

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
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostApplication.name, schema: PostApplicationSchema },
      {
        name: PostApplicationMessage.name,
        schema: PostApplicationMessageSchema,
      },
    ]),
  ],
  controllers: [PostController],
  providers: [PostQueryService, PostService],
  exports: [
    PostService,
    PartnerWriteModule,
    PostQueryService,
    PartnerRepositoryModule,
  ],
})
export class PartnerModule {}
