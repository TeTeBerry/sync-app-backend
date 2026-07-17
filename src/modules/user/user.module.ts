import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import {
  UserProfile,
  UserProfileSchema,
} from '../../database/schemas/user-profile.schema';
import { UserController } from './user.controller';
import { MeController } from './me.controller';
import { UserRepositoryModule } from './user-repository.module';
import { AccountRiskModule } from '../account-risk/account-risk.module';
import { WechatMiniModule } from '../auth/wechat-mini.module';
import { MediaSecurityModule } from '../media-security/media-security.module';
import { UserService } from './user.service';

@Module({
  imports: [
    WechatMiniModule,
    MediaSecurityModule,
    UserRepositoryModule,
    AccountRiskModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
  ],
  controllers: [UserController, MeController],
  providers: [UserService],
  exports: [UserService, UserRepositoryModule],
})
export class UserModule {}
