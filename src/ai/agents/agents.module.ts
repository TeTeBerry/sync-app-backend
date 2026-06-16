import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UserModule } from '../../modules/user/user.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { NoticeAgent } from './notice.agent';
import { UserProfileAgent } from './user-profile.agent';

@Module({
  imports: [
    InfraLlmModule,
    UserModule,
    NotificationModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UserProfileAgent, NoticeAgent],
  exports: [UserProfileAgent, NoticeAgent],
})
export class AgentsModule {}
