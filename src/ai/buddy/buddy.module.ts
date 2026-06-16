import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { AccountRiskModule } from '../../modules/account-risk/account-risk.module';
import { PartnerModule } from '../../modules/partner/partner.module';
import { AgentsModule } from '../agents/agents.module';
import { PostIntentService } from '../post-intent.service';
import { BuddyContextService } from './buddy-context.service';
import { CreatePostFromChatUseCase } from './create-post-from-chat.use-case';

@Module({
  imports: [ActivityModule, AccountRiskModule, PartnerModule, AgentsModule],
  providers: [
    BuddyContextService,
    CreatePostFromChatUseCase,
    PostIntentService,
  ],
  exports: [PostIntentService, BuddyContextService],
})
export class BuddyModule {}
