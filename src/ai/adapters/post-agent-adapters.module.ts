import { Global, Module } from '@nestjs/common';
import { BUDDY_MATCH_HINT_PORT } from '../../modules/activity-experience/ports/buddy-match-hint.port';
import { POST_MODERATION_PORT } from '../../modules/partner/ports/post-moderation.port';
import { POST_NOTIFICATION_PORT } from '../../modules/partner/ports/post-notification.port';
import { AgentsModule } from '../agents/agents.module';
import { BuddyMatchHintAdapter } from './buddy-match-hint.adapter';
import { PostModerationAdapter } from './post-moderation.adapter';
import { PostNotificationAdapter } from './post-notification.adapter';

@Global()
@Module({
  imports: [AgentsModule],
  providers: [
    PostModerationAdapter,
    PostNotificationAdapter,
    BuddyMatchHintAdapter,
    { provide: POST_MODERATION_PORT, useExisting: PostModerationAdapter },
    { provide: POST_NOTIFICATION_PORT, useExisting: PostNotificationAdapter },
    { provide: BUDDY_MATCH_HINT_PORT, useExisting: BuddyMatchHintAdapter },
  ],
  exports: [
    POST_MODERATION_PORT,
    POST_NOTIFICATION_PORT,
    BUDDY_MATCH_HINT_PORT,
  ],
})
export class PostAgentAdaptersModule {}
