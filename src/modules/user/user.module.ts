import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UserController } from './user.controller';
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
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, UserRepositoryModule],
})
export class UserModule {}
