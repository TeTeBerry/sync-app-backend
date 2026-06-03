import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { ProfileModule } from '../../modules/profile/profile.module';
import { AccountRiskModule } from '../../modules/account-risk/account-risk.module';
import { PartnerModule } from '../../modules/partner/partner.module';
import { AgentsModule } from '../agents/agents.module';
import { AiMatchQuotaService } from '../ai-match-quota.service';
import { PostIntentService } from '../post-intent.service';
import { BuddyContextService } from './buddy-context.service';
import { CreatePostFromChatUseCase } from './create-post-from-chat.use-case';
import { MatchPostsFromChatUseCase } from './match-posts.use-case';
import { RecommendBeforeCreateUseCase } from './recommend-before-create.use-case';

@Module({
  imports: [
    ActivityModule,
    AccountRiskModule,
    PartnerModule,
    AgentsModule,
    ProfileModule,
  ],
  providers: [
    AiMatchQuotaService,
    BuddyContextService,
    CreatePostFromChatUseCase,
    MatchPostsFromChatUseCase,
    RecommendBeforeCreateUseCase,
    PostIntentService,
  ],
  exports: [PostIntentService, BuddyContextService],
})
export class BuddyModule {}
