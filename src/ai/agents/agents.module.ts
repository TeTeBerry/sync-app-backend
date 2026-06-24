import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { WechatMiniModule } from '../../modules/auth/wechat-mini.module';
import { UserModule } from '../../modules/user/user.module';
import { PartnerRepositoryModule } from '../../modules/partner/partner-repository.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { NoticeAgent } from './notice.agent';
import { RiskAgent } from './risk.agent';

@Module({
  imports: [
    PartnerRepositoryModule,
    InfraLlmModule,
    UserModule,
    NotificationModule,
    WechatMiniModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [RiskAgent, NoticeAgent],
  exports: [RiskAgent, NoticeAgent],
})
export class AgentsModule {}
