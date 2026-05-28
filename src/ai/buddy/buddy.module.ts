import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { PostModule } from '../../modules/post/post.module';
import { AgentsModule } from '../agents/agents.module';
import { PostIntentService } from '../post-intent.service';
import { BuddyContextService } from './buddy-context.service';
import { CreatePostFromChatUseCase } from './create-post-from-chat.use-case';
import { MatchPostsFromChatUseCase } from './match-posts.use-case';
import { RecommendBeforeCreateUseCase } from './recommend-before-create.use-case';

@Module({
  imports: [ActivityModule, PostModule, AgentsModule],
  providers: [
    BuddyContextService,
    CreatePostFromChatUseCase,
    MatchPostsFromChatUseCase,
    RecommendBeforeCreateUseCase,
    PostIntentService,
  ],
  exports: [PostIntentService, BuddyContextService],
})
export class BuddyModule {}
