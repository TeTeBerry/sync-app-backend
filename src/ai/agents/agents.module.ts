import { Module, forwardRef } from '@nestjs/common';
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
import { UserModule } from '../../modules/user/user.module';
import { PostModule } from '../../modules/post/post.module';
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
    forwardRef(() => PostModule),
    ParserModule,
    UserModule,
    NotificationModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostApplication.name, schema: PostApplicationSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
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
