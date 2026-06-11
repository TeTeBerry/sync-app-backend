import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UserModule } from '../../modules/user/user.module';
import { PartnerRepositoryModule } from '../../modules/partner/partner-repository.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ImageParseAgent } from './image-parse.agent';
import { NoticeAgent } from './notice.agent';
import { RiskAgent } from './risk.agent';
import { TextParseAgent } from './text-parse.agent';
import { UserProfileAgent } from './user-profile.agent';

@Module({
  imports: [
    PartnerRepositoryModule,
    InfraLlmModule,
    UserModule,
    NotificationModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    TextParseAgent,
    ImageParseAgent,
    RiskAgent,
    UserProfileAgent,
    NoticeAgent,
  ],
  exports: [
    TextParseAgent,
    ImageParseAgent,
    RiskAgent,
    UserProfileAgent,
    NoticeAgent,
  ],
})
export class AgentsModule {}
