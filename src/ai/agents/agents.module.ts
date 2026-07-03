import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { WechatMiniModule } from '../../modules/auth/wechat-mini.module';
import { UserModule } from '../../modules/user/user.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { NoticeAgent } from './notice.agent';

@Module({
  imports: [
    InfraLlmModule,
    UserModule,
    NotificationModule,
    WechatMiniModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [NoticeAgent],
  exports: [NoticeAgent],
})
export class AgentsModule {}
