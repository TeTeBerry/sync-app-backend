import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { PartnerModule } from '../../modules/partner/partner.module';
import { AgentsModule } from '../agents/agents.module';
import { PostIntentService } from '../post-intent.service';
import { BuddyContextService } from './buddy-context.service';
import { CreatePostFromChatUseCase } from './create-post-from-chat.use-case';
import { MatchPostsFromChatUseCase } from './match-posts.use-case';
import { RecommendBeforeCreateUseCase } from './recommend-before-create.use-case';

@Module({
  imports: [ActivityModule, PartnerModule, AgentsModule],
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
