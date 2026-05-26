import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from '../../database/schemas/post.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { UserModule } from '../../modules/user/user.module';
import { PostRepositoryModule } from '../../modules/post/post-repository.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { ChromaModule } from '../rag/chroma.module';
import { ParserModule } from '../parser/parser.module';
import { MatchContextService } from '../services/match-context.service';
import { ImageParseAgent } from './image-parse.agent';
import { MatchAgent } from './match.agent';
import { NoticeAgent } from './notice.agent';
import { RiskAgent } from './risk.agent';
import { TextParseAgent } from './text-parse.agent';
import { UserProfileAgent } from './user-profile.agent';

@Module({
  imports: [
    ChromaModule,
    PostRepositoryModule,
    ParserModule,
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
    MatchAgent,
    RiskAgent,
    UserProfileAgent,
    NoticeAgent,
    MatchContextService,
  ],
  exports: [
    TextParseAgent,
    ImageParseAgent,
    MatchAgent,
    RiskAgent,
    UserProfileAgent,
    NoticeAgent,
  ],
})
export class AgentsModule {}
