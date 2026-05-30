import { Global, Module } from '@nestjs/common';
import { POST_MODERATION_PORT } from '../../modules/partner/ports/post-moderation.port';
import { POST_NOTIFICATION_PORT } from '../../modules/partner/ports/post-notification.port';
import { AgentsModule } from '../agents/agents.module';
import { PostModerationAdapter } from './post-moderation.adapter';
import { PostNotificationAdapter } from './post-notification.adapter';

@Global()
@Module({
  imports: [AgentsModule],
  providers: [
    PostModerationAdapter,
    PostNotificationAdapter,
    { provide: POST_MODERATION_PORT, useExisting: PostModerationAdapter },
    { provide: POST_NOTIFICATION_PORT, useExisting: PostNotificationAdapter },
  ],
  exports: [POST_MODERATION_PORT, POST_NOTIFICATION_PORT],
})
export class PostAgentAdaptersModule {}
