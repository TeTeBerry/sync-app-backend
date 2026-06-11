import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PostApplication,
  PostApplicationSchema,
} from '../../database/schemas/post-application.schema';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import {
  UserBlock,
  UserBlockSchema,
} from '../../database/schemas/user-block.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UserBlockService } from './user-block.service';
import { UserController } from './user.controller';
import { UserRepositoryModule } from './user-repository.module';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { WechatMiniModule } from '../auth/wechat-mini.module';
import { MediaSecurityModule } from '../media-security/media-security.module';
import { UserProfileSyncService } from './user-profile-sync.service';
import { UserService } from './user.service';

@Module({
  imports: [
    WechatMiniModule,
    MediaSecurityModule,
    UserRepositoryModule,
    AccountRiskModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
      { name: Post.name, schema: PostSchema },
      { name: PostApplication.name, schema: PostApplicationSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService, UserProfileSyncService, UserBlockService],
  exports: [
    UserService,
    UserProfileSyncService,
    UserBlockService,
    UserRepositoryModule,
  ],
})
export class UserModule {}
