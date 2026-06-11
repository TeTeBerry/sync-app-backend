import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
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
import { USER_REPOSITORY } from './interfaces/user.repository.interface';
import { UserBlockService } from './user-block.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { WechatMiniModule } from '../auth/wechat-mini.module';
import { MediaSecurityModule } from '../media-security/media-security.module';
import { UserProfileSyncService } from './user-profile-sync.service';
import { UserService } from './user.service';

@Module({
  imports: [
    WechatMiniModule,
    forwardRef(() => MediaSecurityModule),
    AccountRiskModule,
    InfraChromaModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
      { name: Post.name, schema: PostSchema },
      { name: PostApplication.name, schema: PostApplicationSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [
    UserRepository,
    { provide: USER_REPOSITORY, useExisting: UserRepository },
    UserService,
    UserProfileSyncService,
    UserBlockService,
  ],
  exports: [
    UserService,
    UserProfileSyncService,
    UserBlockService,
    USER_REPOSITORY,
  ],
})
export class UserModule {}
